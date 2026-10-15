<?php

namespace Tests\Feature;

use App\Jobs\RecordClick;
use App\Models\Click;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\CreatesApiFixtures;
use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    use CreatesApiFixtures;
    use RefreshDatabase;

    public function test_link_breakdowns_are_independent_and_keep_clicks_with_missing_dimensions(): void
    {
        $user = User::factory()->create();
        $link = $this->linkFor($user);
        foreach ([
            ['country' => 'AU', 'device_type' => 'desktop', 'browser' => 'Chrome', 'referer' => 'https://example.com'],
            ['country' => 'US', 'device_type' => 'desktop', 'browser' => 'Chrome', 'referer' => 'https://example.com'],
            ['country' => null, 'device_type' => 'mobile', 'browser' => 'Safari', 'referer' => null],
            ['country' => 'AU', 'device_type' => null, 'browser' => 'Firefox', 'referer' => 'https://other.example'],
        ] as $attributes) {
            Click::create(['link_id' => $link->id, ...$attributes]);
        }
        Click::create(['link_id' => $this->linkFor(User::factory()->create())->id, 'browser' => 'Chrome']);

        $response = $this->withToken($this->tokenFor($user))
            ->getJson("/api/v1/links/{$link->id}/stats")
            ->assertOk()
            ->assertJsonPath('total', 4);

        $this->assertEqualsCanonicalizing([
            ['country' => 'AU', 'total' => 2], ['country' => 'US', 'total' => 1],
        ], $response->json('by_country'));
        $this->assertEqualsCanonicalizing([
            ['device_type' => 'desktop', 'total' => 2], ['device_type' => 'mobile', 'total' => 1],
        ], $response->json('by_device'));
        $this->assertEqualsCanonicalizing([
            ['browser' => 'Chrome', 'total' => 2], ['browser' => 'Safari', 'total' => 1], ['browser' => 'Firefox', 'total' => 1],
        ], $response->json('by_browser'));
        $this->assertEqualsCanonicalizing([
            ['referer' => 'https://example.com', 'total' => 2], ['referer' => 'https://other.example', 'total' => 1],
        ], $response->json('by_referrer'));
    }

    public function test_global_statistics_preserve_bot_date_and_owner_filters(): void
    {
        $this->travelTo(now()->startOfDay()->addHours(12));
        $user = User::factory()->create();
        $link = $this->linkFor($user);
        Click::create(['link_id' => $link->id, 'browser' => 'Chrome']);
        Click::create(['link_id' => $link->id, 'browser' => 'Robot', 'is_bot' => true]);
        Click::create(['link_id' => $this->linkFor(User::factory()->create())->id]);
        $oldClick = Click::create(['link_id' => $link->id]);
        $oldClick->forceFill(['created_at' => now()->subDays(60)])->save();

        $this->withToken($this->tokenFor($user))->getJson('/api/v1/analytics')
            ->assertOk()->assertJsonPath('stats.total', 1)
            ->assertJsonPath('stats.by_browser.0.browser', 'Chrome')
            ->assertJsonPath('scope.matched_links', 1);
        $this->getJson('/api/v1/analytics?include_bots=true')
            ->assertOk()->assertJsonPath('stats.total', 2);
    }

    public function test_quoted_analytics_filters_match_phrases_and_remain_scoped_to_the_owner(): void
    {
        $user = User::factory()->create();
        $link = $this->linkFor($user, ['title' => 'Creator Tools', 'slug' => 'creator-news']);
        $this->linkFor($user, ['title' => 'Creator Other Tools', 'slug' => 'other-news']);
        $this->linkFor(User::factory()->create(), ['title' => 'Creator Tools', 'slug' => 'private-news']);
        Click::create(['link_id' => $link->id]);

        $this->withToken($this->tokenFor($user))->getJson('/api/v1/analytics?'.http_build_query([
            'query' => 'title:"creator tools" contains:news',
        ]))->assertOk()->assertJsonPath('scope.matched_links', 1)->assertJsonPath('stats.total', 1);
    }

    #[DataProvider('invalidRanges')]
    public function test_invalid_analytics_ranges_return_validation_errors(array $params, string $field): void
    {
        $user = User::factory()->create();
        $this->withToken($this->tokenFor($user))->getJson('/api/v1/analytics?'.http_build_query($params))
            ->assertUnprocessable()->assertJsonValidationErrors($field);
    }

    public static function invalidRanges(): array
    {
        return [
            [['from' => 'not-a-date'], 'from'],
            [['to' => ['2026-01-01']], 'to'],
            [['from' => '2026-02-01', 'to' => '2026-01-01'], 'to'],
        ];
    }

    #[DataProvider('granularities')]
    public function test_series_fill_empty_buckets_and_match_filtered_click_totals(string $granularity, int $buckets): void
    {
        $this->travelTo(now()->startOfDay()->addHours(12));
        $user = User::factory()->create();
        $link = $this->linkFor($user, ['title' => 'Creator Tools']);
        (new RecordClick($link->id, null, null, null))->handle();
        (new RecordClick($link->id, null, 'Googlebot/2.1 (+http://www.google.com/bot.html)', null))->handle();
        (new RecordClick($this->linkFor($user, ['title' => 'Other'])->id, null, null, null))->handle();
        (new RecordClick($this->linkFor(User::factory()->create(), ['title' => 'Creator Tools'])->id, null, null, null))->handle();

        $params = [
            'query' => 'title:"creator tools"',
            'from' => now()->toDateString(),
            'to' => now()->addDay()->toDateString(),
            'granularity' => $granularity,
        ];
        $response = $this->withToken($this->tokenFor($user))
            ->getJson('/api/v1/analytics?'.http_build_query($params))
            ->assertOk()->assertJsonPath('stats.total', 1)->assertJsonCount($buckets, 'series');
        $series = collect($response->json('series'));
        $this->assertSame(1, $series->sum('total'));
        $this->assertSame($buckets - 1, $series->where('total', 0)->count());

        $response = $this->getJson('/api/v1/analytics?'.http_build_query([...$params, 'include_bots' => 'true']))
            ->assertOk()->assertJsonPath('stats.total', 2);
        $this->assertSame(2, collect($response->json('series'))->sum('total'));
    }

    public static function granularities(): array
    {
        return [['day', 2], ['hour', 48]];
    }

    public function test_account_totals_count_only_the_owners_clicks(): void
    {
        $user = User::factory()->create();
        $link = $this->linkFor($user);
        $this->linkFor($user);
        Click::create(['link_id' => $link->id]);
        Click::create(['link_id' => $link->id]);
        Click::create(['link_id' => $this->linkFor(User::factory()->create())->id]);

        $this->withToken($this->tokenFor($user))->getJson('/api/v1/user/stats')
            ->assertOk()->assertExactJson(['links' => 2, 'clicks' => 2, 'tags' => 0]);
    }

    public function test_statistics_for_another_users_link_are_not_accessible(): void
    {
        $user = User::factory()->create();
        $link = $this->linkFor(User::factory()->create());
        $this->withToken($this->tokenFor($user))->getJson("/api/v1/links/{$link->id}/stats")->assertNotFound();
    }
}
