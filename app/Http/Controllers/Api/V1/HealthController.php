<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Laravel\Horizon\Contracts\MasterSupervisorRepository;

class HealthController extends Controller
{
    public function queue(Request $request)
    {
        $horizonStatus = 'unavailable';
        if (class_exists(\Laravel\Horizon\Horizon::class) && method_exists(\Laravel\Horizon\Horizon::class, 'status')) {
            $horizonStatus = \Laravel\Horizon\Horizon::status();
        } elseif (app()->bound(MasterSupervisorRepository::class)) {
            try {
                $masters = app(MasterSupervisorRepository::class)->all();
                if (empty($masters)) {
                    $horizonStatus = 'inactive';
                } elseif (collect($masters)->contains(fn ($master) => $master->status === 'running')) {
                    $horizonStatus = 'running';
                } else {
                    $horizonStatus = 'paused';
                }
            } catch (\Throwable $e) {
                $horizonStatus = 'unavailable';
            }
        }

        $pending = null;
        try {
            $pending = Queue::size();
        } catch (\Throwable $e) {
            $pending = null;
        }

        $failed = null;
        try {
            $failed = DB::table('failed_jobs')->count();
        } catch (\Throwable $e) {
            $failed = null;
        }

        return response()->json([
            'status' => $horizonStatus,
            'connection' => config('queue.default'),
            'pending' => $pending,
            'failed' => $failed,
            'checked_at' => now()->toIso8601String(),
        ]);
    }
}
