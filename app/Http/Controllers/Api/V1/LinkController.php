<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Link;
use App\Models\Tag;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Support\Carbon;

class LinkController extends Controller
{
    public function index(Request $request)
    {
        $query = Link::query()
            ->where('user_id', $request->user()->id)
            ->with('tags')
            ->withCount('clicks');

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                if (filter_var($search, FILTER_VALIDATE_URL)) {
                    $builder->where('original_url', $search);
                    return;
                }

                $builder->where('slug', 'ilike', '%' . $search . '%')
                    ->orWhere('original_url', 'ilike', '%' . $search . '%')
                    ->orWhere('title', 'ilike', '%' . $search . '%');
            });
        }

        $status = $request->query('status');
        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $tag = trim((string) $request->query('tag', ''));
        if ($tag !== '') {
            $query->whereHas('tags', function ($builder) use ($tag) {
                $builder->where('id', $tag)
                    ->orWhere('name', 'ilike', '%' . $tag . '%');
            });
        }

        $from = $request->query('from');
        if ($from) {
            try {
                $fromDate = Carbon::parse($from)->startOfDay();
                $query->where('created_at', '>=', $fromDate);
            } catch (\Throwable $e) {
                // Ignore invalid date
            }
        }

        $to = $request->query('to');
        if ($to) {
            try {
                $toDate = Carbon::parse($to)->endOfDay();
                $query->where('created_at', '<=', $toDate);
            } catch (\Throwable $e) {
                // Ignore invalid date
            }
        }

        $perPage = (int) $request->query('per_page', 20);
        $perPage = $perPage > 0 && $perPage <= 100 ? $perPage : 20;

        $links = $query
            ->latest()
            ->paginate($perPage);

        return response()->json($links);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'original_url' => ['required', 'url'],
            'title' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'password' => ['nullable', 'string', 'max:255'],
            'expires_at' => ['nullable', 'date'],
            'max_clicks' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['uuid'],
        ]);

        $data['slug'] = $this->generateSlug();
        $data['user_id'] = $request->user()->id;
        $data['password'] = isset($data['password']) ? Hash::make($data['password']) : null;

        $link = Link::create($data);

        if (!empty($data['tags'])) {
            $tagIds = Tag::query()
                ->where('user_id', $request->user()->id)
                ->whereIn('id', $data['tags'])
                ->pluck('id')
                ->all();
            $link->tags()->sync($tagIds);
        }

        AuditLogger::log($request, 'link.created', Link::class, $link->id, [
            'title' => $link->title,
            'slug' => $link->slug,
            'original_url' => $link->original_url,
            'tags' => $link->tags->pluck('id')->all(),
        ]);

        return response()->json($link->load('tags'), 201);
    }

    public function show(Request $request, string $id)
    {
        $link = Link::query()
            ->where('user_id', $request->user()->id)
            ->with('tags')
            ->findOrFail($id);

        return response()->json($link);
    }

    public function update(Request $request, string $id)
    {
        $link = Link::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $data = $request->validate([
            'original_url' => ['nullable', 'url'],
            'title' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'password' => ['nullable', 'string', 'max:255'],
            'expires_at' => ['nullable', 'date'],
            'max_clicks' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['uuid'],
        ]);

        if (array_key_exists('password', $data)) {
            $data['password'] = $data['password'] ? Hash::make($data['password']) : null;
        }

        $link->update($data);
        $changes = $link->getChanges();
        unset($changes['updated_at']);
        if (array_key_exists('password', $changes)) {
            unset($changes['password']);
            $changes['password_updated'] = true;
        }

        if (array_key_exists('tags', $data)) {
            $tagIds = Tag::query()
                ->where('user_id', $request->user()->id)
                ->whereIn('id', $data['tags'] ?? [])
                ->pluck('id')
                ->all();
            $link->tags()->sync($tagIds);
            $changes['tags'] = $tagIds;
        }

        if (!empty($changes)) {
            AuditLogger::log($request, 'link.updated', Link::class, $link->id, [
                'changes' => $changes,
            ]);
        }

        return response()->json($link->load('tags'));
    }

    public function destroy(Request $request, string $id)
    {
        $link = Link::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $snapshot = [
            'title' => $link->title,
            'slug' => $link->slug,
            'original_url' => $link->original_url,
        ];

        $link->delete();

        AuditLogger::log($request, 'link.deleted', Link::class, $link->id, $snapshot);

        return response()->json(['deleted' => true]);
    }

    public function stats(Request $request, string $id)
    {
        $link = Link::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $base = $link->clicks();

        $response = [
            'total' => $base->count(),
            'by_country' => $base->select('country', DB::raw('count(*) as total'))
                ->whereNotNull('country')
                ->groupBy('country')
                ->orderByDesc('total')
                ->limit(12)
                ->get(),
            'by_device' => $base->select('device_type', DB::raw('count(*) as total'))
                ->whereNotNull('device_type')
                ->groupBy('device_type')
                ->orderByDesc('total')
                ->get(),
            'by_browser' => $base->select('browser', DB::raw('count(*) as total'))
                ->whereNotNull('browser')
                ->groupBy('browser')
                ->orderByDesc('total')
                ->limit(8)
                ->get(),
            'by_referrer' => $base->select('referer', DB::raw('count(*) as total'))
                ->whereNotNull('referer')
                ->groupBy('referer')
                ->orderByDesc('total')
                ->limit(10)
                ->get(),
        ];

        return response()->json($response);
    }

    public function bulk(Request $request)
    {
        $data = $request->validate([
            'links' => ['required', 'array', 'min:1'],
            'links.*.original_url' => ['required', 'url'],
            'links.*.title' => ['nullable', 'string', 'max:255'],
            'links.*.expires_at' => ['nullable', 'date'],
            'links.*.max_clicks' => ['nullable', 'integer', 'min:1'],
        ]);

        $created = [];
        foreach ($data['links'] as $payload) {
            $payload['slug'] = $this->generateSlug();
            $payload['user_id'] = $request->user()->id;
            $created[] = Link::create($payload);
        }

        AuditLogger::log($request, 'link.bulk_created', Link::class, null, [
            'count' => count($created),
        ]);

        return response()->json(['data' => $created], 201);
    }

    public function bulkAction(Request $request)
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['activate', 'deactivate', 'delete', 'tag', 'untag'])],
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['uuid'],
            'tag_id' => ['nullable', 'uuid'],
        ]);

        $links = Link::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('id', $data['ids'])
            ->get();

        $affected = 0;
        switch ($data['action']) {
            case 'activate':
                $affected = Link::query()
                    ->whereIn('id', $links->pluck('id'))
                    ->update(['is_active' => true]);
                break;
            case 'deactivate':
                $affected = Link::query()
                    ->whereIn('id', $links->pluck('id'))
                    ->update(['is_active' => false]);
                break;
            case 'delete':
                $affected = Link::query()
                    ->whereIn('id', $links->pluck('id'))
                    ->delete();
                break;
            case 'tag':
            case 'untag':
                if (empty($data['tag_id'])) {
                    return response()->json(['message' => 'tag_id is required'], 422);
                }
                $tag = Tag::query()
                    ->where('user_id', $request->user()->id)
                    ->where('id', $data['tag_id'])
                    ->firstOrFail();
                foreach ($links as $link) {
                    if ($data['action'] === 'tag') {
                        $link->tags()->syncWithoutDetaching([$tag->id]);
                    } else {
                        $link->tags()->detach($tag->id);
                    }
                    $affected += 1;
                }
                break;
        }

        AuditLogger::log($request, 'link.bulk_action', Link::class, null, [
            'action' => $data['action'],
            'affected' => $affected,
            'ids' => $links->pluck('id')->all(),
            'tag_id' => $data['tag_id'] ?? null,
        ]);

        return response()->json([
            'action' => $data['action'],
            'affected' => $affected,
        ]);
    }

    private function generateSlug(int $length = 7): string
    {
        do {
            $slug = Str::lower(Str::random($length));
        } while (Link::query()->where('slug', $slug)->exists());

        return $slug;
    }
}
