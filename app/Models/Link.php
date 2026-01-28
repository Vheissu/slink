<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Link extends Model
{
    use HasFactory;
    use HasUuids;

    protected $appends = ['has_password'];

    protected $fillable = [
        'user_id',
        'original_url',
        'slug',
        'title',
        'notes',
        'password',
        'expires_at',
        'max_clicks',
        'is_active',
        'health_status',
        'http_status',
        'last_checked_at',
        'last_error',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function getHasPasswordAttribute(): bool
    {
        return !empty($this->attributes['password'] ?? null);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function clicks(): HasMany
    {
        return $this->hasMany(Click::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'link_tag');
    }
}
