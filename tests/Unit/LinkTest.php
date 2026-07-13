<?php

namespace Tests\Unit;

use App\Models\Link;
use PHPUnit\Framework\TestCase;

class LinkTest extends TestCase
{
    public function test_it_reports_whether_a_password_is_set(): void
    {
        $unprotected = new Link;
        $protected = new Link(['password' => 'hashed-password']);

        $this->assertFalse($unprotected->getHasPasswordAttribute());
        $this->assertTrue($protected->getHasPasswordAttribute());
    }
}
