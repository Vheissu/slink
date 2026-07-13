<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ApiTokenAbility
{
    public function handle(Request $request, Closure $next, string ...$abilities)
    {
        $token = $request->attributes->get('api_token');
        if (! $token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $allowed = $token->abilities ?? [];
        if (empty($allowed) || in_array('*', $allowed, true)) {
            return $next($request);
        }

        foreach ($abilities as $ability) {
            if (in_array($ability, $allowed, true)) {
                return $next($request);
            }
        }

        return response()->json(['message' => 'Forbidden'], 403);
    }
}
