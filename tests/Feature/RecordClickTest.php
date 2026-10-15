<?php

namespace Tests\Feature;

use App\Jobs\RecordClick;
use App\Models\Click;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Stevebauman\Location\Facades\Location;
use Tests\Support\CreatesApiFixtures;
use Tests\TestCase;

class RecordClickTest extends TestCase
{
    use CreatesApiFixtures;
    use RefreshDatabase;

    public function test_clicks_and_hourly_totals_are_recorded_together(): void
    {
        $this->travelTo(now()->startOfDay()->addHours(12));
        $link = $this->linkFor(User::factory()->create());
        $job = new RecordClick($link->id, null, null, null);
        $job->handle();
        $job->handle();

        $this->assertDatabaseCount('clicks', 2);
        $this->assertDatabaseCount('click_aggregates', 1);
        $this->assertDatabaseHas('click_aggregates', [
            'link_id' => $link->id, 'hour' => 12, 'total_clicks' => 2, 'is_bot' => false,
        ]);
    }

    public function test_recent_duplicates_skip_geolocation_and_resume_after_one_minute(): void
    {
        $link = $this->linkFor(User::factory()->create());
        Location::shouldReceive('get')->with('203.0.113.1')->twice()->andReturn(false);
        $job = new RecordClick($link->id, '203.0.113.1', null, null);
        $job->handle();
        $job->handle();
        $this->assertDatabaseCount('clicks', 1);
        $this->travel(61)->seconds();
        $job->handle();
        $this->assertDatabaseCount('clicks', 2);
        $this->assertSame(2, (int) DB::table('click_aggregates')->sum('total_clicks'));
        $this->assertNotSame('203.0.113.1', Click::first()->ip_address);
    }

    public function test_aggregate_failures_roll_back_the_click_so_the_job_can_retry(): void
    {
        $link = $this->linkFor(User::factory()->create());
        $failAggregate = true;
        DB::listen(function (QueryExecuted $query) use (&$failAggregate) {
            if ($failAggregate && str_starts_with($query->sql, 'INSERT INTO click_aggregates')) {
                throw new RuntimeException('Aggregate write failed');
            }
        });
        $job = new RecordClick($link->id, null, null, null);

        try {
            $job->handle();
            $this->fail('Expected the aggregate write to fail.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Aggregate write failed', $exception->getMessage());
        }
        $this->assertDatabaseCount('clicks', 0);
        $this->assertDatabaseCount('click_aggregates', 0);

        $failAggregate = false;
        $job->handle();
        $this->assertDatabaseCount('clicks', 1);
        $this->assertDatabaseHas('click_aggregates', ['total_clicks' => 1]);
    }

    public function test_queued_clicks_for_deleted_links_are_discarded(): void
    {
        $link = $this->linkFor(User::factory()->create());
        $link->delete();
        Location::shouldReceive('get')->never();

        (new RecordClick($link->id, '203.0.113.1', null, null))->handle();

        $this->assertDatabaseCount('clicks', 0);
        $this->assertDatabaseCount('click_aggregates', 0);
    }
}
