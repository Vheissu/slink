<?php

namespace App\Jobs;

use App\Models\Click;
use App\Models\Link;
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
        $ipHash = $this->ip ? hash('sha256', $this->ip.config('app.key')) : null;
        if (! Link::query()->whereKey($this->linkId)->exists() || $this->isRecentDuplicate($ipHash)) {
            return;
        }

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

        $isBot = $agent->isRobot();

        DB::transaction(function () use ($agent, $deviceType, $locationData, $ipHash, $isBot) {
            // Serialize writes for this link so concurrent workers cannot both pass deduplication.
            $link = Link::query()->whereKey($this->linkId)->lockForUpdate()->first();
            if (! $link || $this->isRecentDuplicate($ipHash)) {
                return;
            }

            $click = Click::create([
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

            $now = $click->created_at;
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
        });
    }

    private function isRecentDuplicate(?string $ipHash): bool
    {
        return $ipHash !== null && Click::query()
            ->where('link_id', $this->linkId)
            ->where('ip_address', $ipHash)
            ->where('created_at', '>=', now()->subMinute())
            ->exists();
    }
}
