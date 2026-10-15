<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Click;
use App\Models\Link;
use App\Support\AnalyticsQuery;
use App\Support\ClickStatistics;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'query' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $query = trim((string) $request->query('query', ''));
        $userId = $request->user()->id;
        $includeBots = filter_var($request->query('include_bots', false), FILTER_VALIDATE_BOOL);

        $fromParam = $request->query('from');
        $toParam = $request->query('to');
        $from = $fromParam ? Carbon::parse($fromParam) : now()->subDays(30);
        $to = $toParam ? Carbon::parse($toParam) : now();
        $from = $from->startOfDay();
        $to = $to->endOfDay();

        if ($to->lessThan($from)) {
            throw ValidationException::withMessages(['to' => 'The end date must be on or after the start date.']);
        }

        $granularity = $request->query('granularity');
        if (! in_array($granularity, ['day', 'hour'], true)) {
            $granularity = $from->diffInDays($to) <= 2 ? 'hour' : 'day';
        }

        $linksQuery = Link::query()->where('user_id', $userId);
        if ($query !== '') {
            $filters = AnalyticsQuery::parse($query);
            $linksQuery->where(function ($builder) use ($filters) {
                foreach (['url' => 'original_url', 'slug' => 'slug', 'title' => 'title'] as $key => $column) {
                    foreach ($filters[$key] as $value) {
                        $builder->whereLike($column, '%'.$value.'%');
                    }
                }
                foreach (array_merge($filters['contains'], $filters['free']) as $value) {
                    $builder->where(function ($inner) use ($value) {
                        $inner->whereLike('slug', '%'.$value.'%')
                            ->orWhereLike('original_url', '%'.$value.'%')
                            ->orWhereLike('title', '%'.$value.'%');
                    });
                }
            });
        }

        $matchedLinks = (clone $linksQuery)->count();

        $base = Click::query()
            ->whereIn('link_id', (clone $linksQuery)->select('id'))
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
            'stats' => ClickStatistics::summarize($base),
        ];

        return response()->json($response);
    }

    private function buildSeries(Builder $linksQuery, Carbon $from, Carbon $to, string $granularity, bool $includeBots): array
    {
        $aggregate = DB::table('click_aggregates')
            ->whereIn('link_id', (clone $linksQuery)->select('id'))
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
}
