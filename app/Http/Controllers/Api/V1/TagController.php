<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tag;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class TagController extends Controller
{
    public function index(Request $request)
    {
        $tags = Tag::query()
            ->where('user_id', $request->user()->id)
            ->orderBy('name')
            ->get();

        return response()->json($tags);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64'],
            'color' => ['nullable', 'string', 'size:7'],
        ]);

        $tag = Tag::create([
            'user_id' => $request->user()->id,
            'name' => $data['name'],
            'color' => $data['color'] ?? '#0f3460',
        ]);

        AuditLogger::log($request, 'tag.created', Tag::class, $tag->id, [
            'name' => $tag->name,
            'color' => $tag->color,
        ]);

        return response()->json($tag, 201);
    }

    public function destroy(Request $request, string $id)
    {
        $tag = Tag::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $snapshot = [
            'name' => $tag->name,
            'color' => $tag->color,
        ];

        $tag->delete();

        AuditLogger::log($request, 'tag.deleted', Tag::class, $tag->id, $snapshot);

        return response()->json(['deleted' => true]);
    }
}
