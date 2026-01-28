<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AnalyticsController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\LinkController;
use App\Http\Controllers\Api\V1\TagController;
use App\Http\Controllers\Api\V1\UserController;

Route::prefix('v1')->middleware(['api_token', 'throttle:api'])->group(function () {
    Route::get('/health/queue', [HealthController::class, 'queue'])->middleware('token_ability:health:read');
    Route::get('/analytics', [AnalyticsController::class, 'index'])->middleware('token_ability:analytics:read');
    Route::get('/audit-logs', [AuditLogController::class, 'index'])->middleware('token_ability:audit:read');

    Route::get('/links', [LinkController::class, 'index'])->middleware('token_ability:links:read');
    Route::post('/links', [LinkController::class, 'store'])->middleware('token_ability:links:write');
    Route::post('/links/bulk', [LinkController::class, 'bulk'])->middleware('token_ability:links:write');
    Route::post('/links/actions', [LinkController::class, 'bulkAction'])->middleware('token_ability:links:write');
    Route::get('/links/{id}', [LinkController::class, 'show'])->whereUuid('id')->middleware('token_ability:links:read');
    Route::patch('/links/{id}', [LinkController::class, 'update'])->whereUuid('id')->middleware('token_ability:links:write');
    Route::delete('/links/{id}', [LinkController::class, 'destroy'])->whereUuid('id')->middleware('token_ability:links:write');
    Route::get('/links/{id}/stats', [LinkController::class, 'stats'])->whereUuid('id')->middleware('token_ability:links:read');

    Route::get('/tags', [TagController::class, 'index'])->middleware('token_ability:tags:read');
    Route::post('/tags', [TagController::class, 'store'])->middleware('token_ability:tags:write');
    Route::delete('/tags/{id}', [TagController::class, 'destroy'])->middleware('token_ability:tags:write');

    Route::get('/user', [UserController::class, 'profile'])->middleware('token_ability:user:read');
    Route::get('/user/stats', [UserController::class, 'stats'])->middleware('token_ability:user:read');
    Route::post('/user/tokens', [UserController::class, 'createToken'])->middleware('token_ability:tokens:write');
    Route::delete('/user/tokens/{id}', [UserController::class, 'revokeToken'])
        ->whereUuid('id')
        ->middleware('token_ability:tokens:write');
});
