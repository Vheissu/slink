<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ClickStatistics
{
    private const DIMENSIONS = [
        'by_country' => ['country', 12],
        'by_device' => ['device_type', null],
        'by_browser' => ['browser', 8],
        'by_referrer' => ['referer', 10],
    ];

    public static function summarize(Builder $clicks): array
    {
        $stats = ['total' => (clone $clicks)->count()];

        foreach (self::DIMENSIONS as $key => [$column, $limit]) {
            // Each breakdown must keep the scope without inheriting another dimension's filters.
            $query = (clone $clicks)
                ->select($column, DB::raw('count(*) as total'))
                ->whereNotNull($column)
                ->groupBy($column)
                ->orderByDesc('total');

            if ($limit !== null) {
                $query->limit($limit);
            }

            $stats[$key] = $query->get();
        }

        return $stats;
    }
}
