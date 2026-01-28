<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('links', function (Blueprint $table) {
            $table->string('health_status', 32)->default('unknown')->after('is_active');
            $table->unsignedSmallInteger('http_status')->nullable()->after('health_status');
            $table->timestamp('last_checked_at')->nullable()->after('http_status');
            $table->text('last_error')->nullable()->after('last_checked_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('links', function (Blueprint $table) {
            $table->dropColumn(['health_status', 'http_status', 'last_checked_at', 'last_error']);
        });
    }
};
