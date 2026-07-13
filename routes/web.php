<?php

use App\Http\Controllers\RedirectController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::view('/{path}', 'welcome')
    ->where('path', 'dashboard|links|analytics|settings');

Route::post('/{slug}/verify', [RedirectController::class, 'verify'])
    ->where('slug', '[A-Za-z0-9_-]+');

Route::get('/{slug}', [RedirectController::class, 'redirect'])
    ->where('slug', '[A-Za-z0-9_-]+');
