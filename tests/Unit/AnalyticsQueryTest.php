<?php

namespace Tests\Unit;

use App\Support\AnalyticsQuery;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class AnalyticsQueryTest extends TestCase
{
    #[DataProvider('queries')]
    public function test_it_parses_search_operators_and_quoted_phrases(string $query, array $expected): void
    {
        $this->assertSame(
            array_replace(['url' => [], 'slug' => [], 'title' => [], 'contains' => [], 'free' => []], $expected),
            AnalyticsQuery::parse($query),
        );
    }

    public static function queries(): array
    {
        return [
            'double quoted operator' => ['title:"creator tools" slug:news', ['title' => ['creator tools'], 'slug' => ['news']]],
            'single quoted operator' => ["title:'creator tools'", ['title' => ['creator tools']]],
            'free phrases' => ['"creator tools" news', ['free' => ['creator tools', 'news']]],
            'aliases and case' => ['LINK:example original_url:articles TITLE:News', ['url' => ['example', 'articles'], 'title' => ['News']]],
            'full url' => ['https://example.com/articles?tag=news', ['url' => ['https://example.com/articles?tag=news']]],
            'url operator' => ['url:https://example.com slug:article', ['url' => ['https://example.com'], 'slug' => ['article']]],
            'repeated operators' => ['contains:news contains:daily', ['contains' => ['news', 'daily']]],
            'unknown operator' => ['author:dwayne', ['free' => ['author:dwayne']]],
            'empty values' => ['title:"" slug: contains:\'\' ""', []],
            'whitespace' => ["  title:news\tcontains:daily  ", ['title' => ['news'], 'contains' => ['daily']]],
            'apostrophe' => ["O'Reilly", ['free' => ["O'Reilly"]]],
        ];
    }
}
