<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::query()
            ->where('user_id', $request->user()->id);

        $action = trim((string) $request->query('action', ''));
        if ($action !== '') {
            $query->where('action', $action);
        }

        $subjectType = trim((string) $request->query('subject_type', ''));
        if ($subjectType !== '') {
            $query->where('subject_type', $subjectType);
        }

        $subjectId = trim((string) $request->query('subject_id', ''));
        if ($subjectId !== '') {
            $query->where('subject_id', $subjectId);
        }

        $from = $request->query('from');
        if ($from) {
            try {
                $fromDate = Carbon::parse($from)->startOfDay();
                $query->where('created_at', '>=', $fromDate);
            } catch (\Throwable $e) {
                // Ignore invalid date
            }
        }

        $to = $request->query('to');
        if ($to) {
            try {
                $toDate = Carbon::parse($to)->endOfDay();
                $query->where('created_at', '<=', $toDate);
            } catch (\Throwable $e) {
                // Ignore invalid date
            }
        }

        $perPage = (int) $request->query('per_page', 20);
        $perPage = $perPage > 0 && $perPage <= 100 ? $perPage : 20;

        return response()->json(
            $query->latest()->paginate($perPage)
        );
    }
}
