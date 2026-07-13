<?php

namespace App\Http\Controllers;

use App\Jobs\RecordClick;
use App\Models\Link;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class RedirectController extends Controller
{
    public function redirect(Request $request, string $slug)
    {
        $link = Link::query()->where('slug', $slug)->firstOrFail();

        if (! $link->is_active) {
            return response()->json(['message' => 'Link inactive'], 410);
        }

        if ($link->expires_at && now()->greaterThan($link->expires_at)) {
            return response()->json(['message' => 'Link expired'], 410);
        }

        if ($link->max_clicks && $link->clicks()->count() >= $link->max_clicks) {
            return response()->json(['message' => 'Link limit reached'], 410);
        }

        if ($link->password && ! $this->hasValidToken($request, $link->id)) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Password required'], 403);
            }

            return response()->view('link-password', [
                'slug' => $slug,
                'title' => $link->title ?: $slug,
                'error' => session('error'),
            ]);
        }

        if (app()->environment('local') || config('queue.default') === 'sync') {
            RecordClick::dispatchSync(
                $link->id,
                $request->ip(),
                $request->userAgent(),
                $request->headers->get('referer')
            );
        } else {
            RecordClick::dispatch(
                $link->id,
                $request->ip(),
                $request->userAgent(),
                $request->headers->get('referer')
            );
        }

        return redirect()->away($link->original_url);
    }

    public function verify(Request $request, string $slug)
    {
        $link = Link::query()->where('slug', $slug)->firstOrFail();

        if (! $link->password) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Link not protected'], 422);
            }

            return redirect()->to('/'.$slug);
        }

        $data = $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (! password_verify($data['password'], $link->password ?? '')) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Invalid password'], 422);
            }

            return redirect()->to('/'.$slug)->with('error', 'Invalid password');
        }

        $token = Str::random(32);
        Cache::put($this->tokenCacheKey($token), $link->id, now()->addMinutes(10));

        if ($request->expectsJson()) {
            return response()->json([
                'token' => $token,
                'expires_in' => 600,
            ]);
        }

        return redirect()->to('/'.$slug.'?token='.$token);
    }

    private function hasValidToken(Request $request, string $linkId): bool
    {
        $token = $request->query('token');
        if (! $token) {
            return false;
        }

        return Cache::get($this->tokenCacheKey($token)) === $linkId;
    }

    private function tokenCacheKey(string $token): string
    {
        return 'link-verify:'.$token;
    }
}
