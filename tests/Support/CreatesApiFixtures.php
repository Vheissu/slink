<?php

namespace Tests\Support;

use App\Models\ApiToken;
use App\Models\Link;
use App\Models\User;
use Illuminate\Support\Str;

trait CreatesApiFixtures
{
    private function tokenFor(User $user, array $abilities = ['*'], mixed $expiresAt = null): string
    {
        $plainTextToken = Str::random(40);

        ApiToken::create([
            'user_id' => $user->id,
            'name' => 'Test token',
            'token' => hash('sha256', $plainTextToken),
            'abilities' => $abilities,
            'expires_at' => $expiresAt,
        ]);

        return $plainTextToken;
    }

    private function linkFor(User $user, array $attributes = []): Link
    {
        return Link::create(array_merge([
            'user_id' => $user->id,
            'original_url' => 'https://example.com/'.Str::random(8),
            'slug' => Str::random(8),
            'title' => null,
        ], $attributes));
    }
}
