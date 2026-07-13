<?php

namespace Database\Seeders;

use App\Models\ApiToken;
use App\Models\Link;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'admin@slink.local'],
            [
                'name' => 'Slink Admin',
                'password' => Hash::make('password'),
                'role' => 'admin',
            ],
        );

        $tags = collect([
            ['name' => 'Video', 'color' => '#0f766e'],
            ['name' => 'Search', 'color' => '#2563eb'],
            ['name' => 'News', 'color' => '#f97316'],
            ['name' => 'Developer', 'color' => '#111827'],
        ])->mapWithKeys(function (array $tag) use ($user) {
            $model = Tag::query()->firstOrCreate(
                ['user_id' => $user->id, 'name' => $tag['name']],
                ['color' => $tag['color']],
            );

            return [$tag['name'] => $model];
        });

        $links = [
            [
                'title' => 'YouTube',
                'original_url' => 'https://youtube.com',
                'slug' => 'youtube',
                'tags' => ['Video'],
            ],
            [
                'title' => 'Google Search',
                'original_url' => 'https://google.com',
                'slug' => 'google',
                'tags' => ['Search'],
            ],
            [
                'title' => 'Hacker News',
                'original_url' => 'https://news.ycombinator.com',
                'slug' => 'hn',
                'tags' => ['News'],
            ],
            [
                'title' => 'GitHub',
                'original_url' => 'https://github.com',
                'slug' => 'github',
                'tags' => ['Developer'],
            ],
        ];

        foreach ($links as $payload) {
            $link = Link::query()->firstOrCreate(
                ['slug' => $payload['slug']],
                [
                    'user_id' => $user->id,
                    'title' => $payload['title'],
                    'original_url' => $payload['original_url'],
                    'is_active' => true,
                ],
            );

            $tagIds = collect($payload['tags'] ?? [])
                ->map(fn (string $name) => $tags[$name]?->id)
                ->filter()
                ->all();

            if (! empty($tagIds)) {
                $link->tags()->sync($tagIds);
            }
        }

        $plainToken = env('SLINK_SEED_TOKEN');
        if (! $plainToken) {
            $plainToken = Str::random(40);
            $this->command?->warn('Generated SLINK_SEED_TOKEN (store for local use): '.$plainToken);
        }

        $hashed = hash('sha256', $plainToken);
        ApiToken::query()->firstOrCreate(
            ['token' => $hashed],
            [
                'user_id' => $user->id,
                'name' => 'Local development',
                'abilities' => ['*'],
            ],
        );
    }
}
