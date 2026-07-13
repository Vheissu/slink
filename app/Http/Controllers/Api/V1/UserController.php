<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function profile(Request $request)
    {
        return response()->json($request->user());
    }

    public function stats(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'links' => $user->links()->count(),
            'clicks' => $user->links()->withCount('clicks')->get()->sum('clicks_count'),
            'tags' => $user->tags()->count(),
        ]);
    }

    public function createToken(Request $request)
    {
        $allowed = config('api_tokens.abilities', ['*']);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['nullable', 'array'],
            'abilities.*' => ['string', Rule::in($allowed)],
            'expires_at' => ['nullable', 'date'],
        ]);

        $plainToken = Str::random(40);
        $hashed = hash('sha256', $plainToken);

        $abilities = $data['abilities'] ?? config('api_tokens.default', ['*']);
        if (empty($abilities)) {
            $abilities = config('api_tokens.default', ['*']);
        }

        $token = ApiToken::create([
            'user_id' => $request->user()->id,
            'name' => $data['name'],
            'token' => $hashed,
            'abilities' => $abilities,
            'expires_at' => $data['expires_at'] ?? null,
        ]);

        AuditLogger::log($request, 'token.created', ApiToken::class, $token->id, [
            'name' => $token->name,
            'abilities' => $token->abilities,
            'expires_at' => $token->expires_at,
        ]);

        return response()->json([
            'token' => $plainToken,
            'token_id' => $token->id,
            'expires_at' => $token->expires_at,
        ], 201);
    }

    public function revokeToken(Request $request, string $id)
    {
        $token = ApiToken::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $snapshot = [
            'name' => $token->name,
            'abilities' => $token->abilities,
        ];

        $token->delete();

        AuditLogger::log($request, 'token.revoked', ApiToken::class, $id, $snapshot);

        return response()->json(['deleted' => true]);
    }
}
