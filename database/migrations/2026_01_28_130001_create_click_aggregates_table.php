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
        Schema::create('click_aggregates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('link_id')->index();
            $table->date('date')->index();
            $table->unsignedTinyInteger('hour');
            $table->boolean('is_bot')->default(false);
            $table->unsignedInteger('total_clicks')->default(0);
            $table->timestamps();

            $table->unique(['link_id', 'date', 'hour', 'is_bot']);
            $table->foreign('link_id')->references('id')->on('links')->cascadeOnDelete();
            $table->index(['link_id', 'date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('click_aggregates');
    }
};
