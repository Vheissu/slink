<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Click;
use App\Models\Link;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $query = trim((string) $request->query('query', ''));
        $userId = $request->user()->id;
        $includeBots = filter_var($request->query('include_bots', false), FILTER_VALIDATE_BOOL);

        $fromParam = $request->query('from');
        $toParam = $request->query('to');
        $from = $fromParam ? Carbon::parse($fromParam) : now()->subDays(30);
        $to = $toParam ? Carbon::parse($toParam) : now();
        $from = $from->startOfDay();
        $to = $to->endOfDay();

        $granularity = $request->query('granularity');
        if (! in_array($granularity, ['day', 'hour'], true)) {
            $granularity = $from->diffInDays($to) <= 2 ? 'hour' : 'day';
        }

        $linksQuery = Link::query()->where('user_id', $userId);
        if ($query !== '') {
            $filters = $this->parseQueryFilters($query);
            $linksQuery->where(function ($builder) use ($filters) {
                foreach ($filters['url'] as $value) {
                    $builder->where('original_url', 'ilike', '%'.$value.'%');
                }
                foreach ($filters['slug'] as $value) {
                    $builder->where('slug', 'ilike', '%'.$value.'%');
                }
                foreach ($filters['title'] as $value) {
                    $builder->where('title', 'ilike', '%'.$value.'%');
                }
                foreach ($filters['contains'] as $value) {
                    $builder->where(function ($inner) use ($value) {
                        $inner->where('slug', 'ilike', '%'.$value.'%')
                            ->orWhere('original_url', 'ilike', '%'.$value.'%')
                            ->orWhere('title', 'ilike', '%'.$value.'%');
                    });
                }
                foreach ($filters['free'] as $value) {
                    $builder->where(function ($inner) use ($value) {
                        $inner->where('slug', 'ilike', '%'.$value.'%')
                            ->orWhere('original_url', 'ilike', '%'.$value.'%')
                            ->orWhere('title', 'ilike', '%'.$value.'%');
                    });
                }
            });
        }

        $matchedLinks = (clone $linksQuery)->count();

        $base = Click::query()
            ->whereHas('link', function ($builder) use ($linksQuery) {
                $builder->whereIn('id', $linksQuery->select('id'));
            })
            ->whereBetween('created_at', [$from, $to]);

        if (! $includeBots) {
            $base->where('is_bot', false);
        }

        $series = $this->buildSeries($linksQuery, $from, $to, $granularity, $includeBots);

        $response = [
            'scope' => [
                'query' => $query !== '' ? $query : null,
                'mode' => $query !== '' ? 'filtered' : 'global',
                'matched_links' => $matchedLinks,
            ],
            'range' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'granularity' => $granularity,
                'include_bots' => $includeBots,
            ],
            'series' => $series,
            'stats' => [
                'total' => (clone $base)->count(),
                'by_country' => (clone $base)->select('country', DB::raw('count(*) as total'))
                    ->whereNotNull('country')
                    ->groupBy('country')
                    ->orderByDesc('total')
                    ->limit(12)
                    ->get(),
                'by_device' => (clone $base)->select('device_type', DB::raw('count(*) as total'))
                    ->whereNotNull('device_type')
                    ->groupBy('device_type')
                    ->orderByDesc('total')
                    ->get(),
                'by_browser' => (clone $base)->select('browser', DB::raw('count(*) as total'))
                    ->whereNotNull('browser')
                    ->groupBy('browser')
                    ->orderByDesc('total')
                    ->limit(8)
                    ->get(),
                'by_referrer' => (clone $base)->select('referer', DB::raw('count(*) as total'))
                    ->whereNotNull('referer')
                    ->groupBy('referer')
                    ->orderByDesc('total')
                    ->limit(10)
                    ->get(),
            ],
        ];

        return response()->json($response);
    }

    private function buildSeries($linksQuery, Carbon $from, Carbon $to, string $granularity, bool $includeBots): array
    {
        $aggregate = DB::table('click_aggregates')
            ->whereIn('link_id', $linksQuery->select('id'))
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()]);

        if (! $includeBots) {
            $aggregate->where('is_bot', false);
        }

        if ($granularity === 'hour') {
            $rows = $aggregate
                ->select('date', 'hour', DB::raw('sum(total_clicks) as total'))
                ->groupBy('date', 'hour')
                ->orderBy('date')
                ->orderBy('hour')
                ->get();

            $map = [];
            foreach ($rows as $row) {
                $key = sprintf('%s %02d', $row->date, $row->hour);
                $map[$key] = (int) $row->total;
            }

            $series = [];
            $cursor = $from->copy()->startOfHour();
            while ($cursor <= $to) {
                $key = $cursor->format('Y-m-d H');
                $series[] = [
                    'label' => $cursor->format('Y-m-d H:00'),
                    'total' => $map[$key] ?? 0,
                ];
                $cursor->addHour();
            }

            return $series;
        }

        $rows = $aggregate
            ->select('date', DB::raw('sum(total_clicks) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map[$row->date] = (int) $row->total;
        }

        $series = [];
        $cursor = $from->copy()->startOfDay();
        while ($cursor <= $to) {
            $key = $cursor->toDateString();
            $series[] = [
                'label' => $key,
                'total' => $map[$key] ?? 0,
            ];
            $cursor->addDay();
        }

        return $series;
    }

    private function parseQueryFilters(string $query): array
    {
        $filters = [
            'url' => [],
            'slug' => [],
            'title' => [],
            'contains' => [],
            'free' => [],
        ];

        if (filter_var($query, FILTER_VALIDATE_URL)) {
            $filters['url'][] = $query;

            return $filters;
        }

        preg_match_all('/"([^"]*)"|\'([^\']*)\'|(\\S+)/', $query, $matches);
        $tokens = [];
        foreach ($matches[0] as $index => $token) {
            $token = $matches[1][$index] !== '' ? $matches[1][$index] : $token;
            $token = $matches[2][$index] !== '' ? $matches[2][$index] : $token;
            $token = trim($token);
            if ($token !== '') {
                $tokens[] = $token;
            }
        }

        foreach ($tokens as $token) {
            $parts = explode(':', $token, 2);
            if (count($parts) === 2) {
                $key = strtolower($parts[0]);
                $value = trim($parts[1]);
                if ($value === '') {
                    continue;
                }
                switch ($key) {
                    case 'url':
                    case 'link':
                    case 'original_url':
                        $filters['url'][] = $value;

                        continue 2;
                    case 'slug':
                        $filters['slug'][] = $value;

                        continue 2;
                    case 'title':
                        $filters['title'][] = $value;

                        continue 2;
                    case 'contains':
                        $filters['contains'][] = $value;

                        continue 2;
                }
            }

            $filters['free'][] = $token;
        }

        return $filters;
    }
}
