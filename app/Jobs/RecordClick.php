<?php

namespace App\Jobs;

use App\Models\Click;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Jenssegers\Agent\Agent;
use Stevebauman\Location\Facades\Location;

class RecordClick implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public string $linkId,
        public ?string $ip,
        public ?string $userAgent,
        public ?string $referer,
    ) {}

    public function handle(): void
    {
        $agent = new Agent;
        if ($this->userAgent) {
            $agent->setUserAgent($this->userAgent);
        }

        $deviceType = 'desktop';
        if ($agent->isTablet()) {
            $deviceType = 'tablet';
        } elseif ($agent->isMobile()) {
            $deviceType = 'mobile';
        }

        $locationData = null;
        if ($this->ip) {
            try {
                $locationData = Location::get($this->ip);
            } catch (\Throwable $e) {
                $locationData = null;
            }
        }

        if (! is_object($locationData)) {
            $locationData = null;
        }

        $ipHash = $this->ip ? hash('sha256', $this->ip.config('app.key')) : null;
        if ($ipHash) {
            $recentDuplicate = Click::query()
                ->where('link_id', $this->linkId)
                ->where('ip_address', $ipHash)
                ->where('created_at', '>=', now()->subMinute())
                ->exists();

            if ($recentDuplicate) {
                return;
            }
        }

        $isBot = $agent->isRobot();

        Click::create([
            'link_id' => $this->linkId,
            'ip_address' => $ipHash,
            'user_agent' => $this->userAgent,
            'referer' => $this->referer,
            'country' => $locationData?->countryCode,
            'city' => $locationData?->cityName,
            'device_type' => $deviceType,
            'browser' => $agent->browser(),
            'os' => $agent->platform(),
            'is_bot' => $isBot,
        ]);

        $now = now();
        $date = $now->toDateString();
        $hour = (int) $now->format('H');

        DB::statement(
            'INSERT INTO click_aggregates (id, link_id, date, hour, is_bot, total_clicks, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)
             ON CONFLICT (link_id, date, hour, is_bot)
             DO UPDATE SET total_clicks = click_aggregates.total_clicks + 1, updated_at = EXCLUDED.updated_at',
            [
                (string) Str::uuid(),
                $this->linkId,
                $date,
                $hour,
                $isBot,
                $now,
                $now,
            ]
        );
    }
}
