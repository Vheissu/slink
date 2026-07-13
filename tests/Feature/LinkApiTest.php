<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\Link;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class LinkApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_links_require_an_api_token(): void
    {
        $this->getJson('/api/v1/links')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthorized');
    }

    public function test_expired_api_tokens_are_rejected(): void
    {
        $user = User::factory()->create();
        $token = $this->tokenFor($user, ['links:read'], now()->subMinute());

        $this->withToken($token)
            ->getJson('/api/v1/links')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Token expired');
    }

    public function test_read_only_tokens_cannot_create_links(): void
    {
        $user = User::factory()->create();
        $token = $this->tokenFor($user, ['links:read']);

        $this->withToken($token)
            ->postJson('/api/v1/links', ['original_url' => 'https://example.com'])
            ->assertForbidden()
            ->assertJsonPath('message', 'Forbidden');
    }

    public function test_link_creation_hashes_passwords_and_writes_an_audit_log(): void
    {
        $user = User::factory()->create();
        $token = $this->tokenFor($user, ['links:write']);

        $response = $this->withToken($token)->postJson('/api/v1/links', [
            'original_url' => 'https://example.com/articles/one',
            'title' => 'Article one',
            'password' => 'correct horse battery staple',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('original_url', 'https://example.com/articles/one')
            ->assertJsonPath('title', 'Article one')
            ->assertJsonPath('has_password', true)
            ->assertJsonPath('is_active', true)
            ->assertJsonMissingPath('password');

        $link = Link::findOrFail($response->json('id'));

        $this->assertSame($user->id, $link->user_id);
        $this->assertTrue(Hash::check('correct horse battery staple', $link->password));
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'link.created',
            'subject_id' => $link->id,
        ]);
    }

    public function test_link_destinations_must_use_http_or_https(): void
    {
        $user = User::factory()->create();
        $token = $this->tokenFor($user, ['links:write']);

        $this->withToken($token)
            ->postJson('/api/v1/links', ['original_url' => 'javascript:alert(1)'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('original_url');

        $this->withToken($token)
            ->postJson('/api/v1/links/bulk', [
                'links' => [['original_url' => 'ftp://example.com/archive']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('links.0.original_url');
    }

    public function test_updating_metadata_does_not_clear_the_destination(): void
    {
        $user = User::factory()->create();
        $token = $this->tokenFor($user, ['links:write']);
        $link = $this->linkFor($user, ['original_url' => 'https://example.com/original']);

        $this->withToken($token)
            ->patchJson("/api/v1/links/{$link->id}", ['title' => 'Renamed'])
            ->assertOk()
            ->assertJsonPath('title', 'Renamed')
            ->assertJsonPath('original_url', 'https://example.com/original');

        $this->withToken($token)
            ->patchJson("/api/v1/links/{$link->id}", ['original_url' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('original_url');
    }

    public function test_link_listing_is_paginated_and_scoped_to_the_token_owner(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $token = $this->tokenFor($user, ['links:read']);

        $this->linkFor($user);
        $this->linkFor($user);
        $this->linkFor($user);
        $otherLink = $this->linkFor($otherUser);

        $response = $this->withToken($token)->getJson('/api/v1/links?per_page=2');

        $response
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('current_page', 1)
            ->assertJsonPath('last_page', 2)
            ->assertJsonPath('per_page', 2)
            ->assertJsonPath('total', 3)
            ->assertJsonMissing(['id' => $otherLink->id]);
    }

    private function tokenFor(User $user, array $abilities, mixed $expiresAt = null): string
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
