<?php

namespace App\Console\Commands;

use App\Jobs\CheckLinkHealth;
use App\Models\Link;
use Illuminate\Console\Command;

class CheckLinksHealth extends Command
{
    protected $signature = 'links:check-health {--all : Check all active links} {--limit=200 : Max links to check}';

    protected $description = 'Check health of active links and update status fields.';

    public function handle(): int
    {
        $limit = (int) $this->option('limit');
        $limit = $limit > 0 ? $limit : 200;

        $query = Link::query()->where('is_active', true);
        if (!$this->option('all')) {
            $query->where(function ($builder) {
                $builder->whereNull('last_checked_at')
                    ->orWhere('last_checked_at', '<=', now()->subHours(24));
            });
        }

        $links = $query->limit($limit)->get();
        if ($links->isEmpty()) {
            $this->info('No links require a health check.');
            return self::SUCCESS;
        }

        foreach ($links as $link) {
            if (app()->environment('local') || config('queue.default') === 'sync') {
                CheckLinkHealth::dispatchSync($link->id);
            } else {
                CheckLinkHealth::dispatch($link->id);
            }
        }

        $this->info('Queued health checks for ' . $links->count() . ' links.');
        return self::SUCCESS;
    }
}
