<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogger
{
    public static function log(
        Request $request,
        string $action,
        ?string $subjectType = null,
        ?string $subjectId = null,
        array $metadata = []
    ): void {
        $user = $request->user();

        AuditLog::create([
            'user_id' => $user?->id,
            'actor_type' => $user ? 'user' : 'system',
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'metadata' => $metadata ?: null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
}
