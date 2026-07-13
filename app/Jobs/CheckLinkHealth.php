<?php

namespace App\Jobs;

use App\Models\Link;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class CheckLinkHealth implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(public string $linkId) {}

    public function handle(): void
    {
        $link = Link::query()->find($this->linkId);
        if (! $link) {
            return;
        }

        $status = 'unknown';
        $httpStatus = null;
        $error = null;

        try {
            $response = Http::timeout(6)
                ->withUserAgent('SlinkBot/1.0')
                ->head($link->original_url);

            if ($response->status() === 405) {
                $response = Http::timeout(6)
                    ->withUserAgent('SlinkBot/1.0')
                    ->get($link->original_url);
            }

            $httpStatus = $response->status();
            if ($response->successful() || ($httpStatus >= 300 && $httpStatus < 400)) {
                $status = 'healthy';
            } else {
                $status = 'unreachable';
            }
        } catch (\Throwable $e) {
            $status = 'unreachable';
            $error = $e->getMessage();
        }

        $link->forceFill([
            'health_status' => $status,
            'http_status' => $httpStatus,
            'last_checked_at' => now(),
            'last_error' => $error,
        ])->save();
    }
}
