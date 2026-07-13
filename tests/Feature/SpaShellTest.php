<?php

namespace Tests\Feature;

use Tests\TestCase;

class SpaShellTest extends TestCase
{
    public function test_workspace_routes_render_the_application_shell(): void
    {
        foreach (['/', '/dashboard', '/links', '/analytics', '/settings'] as $path) {
            $this->get($path)
                ->assertOk()
                ->assertSee('id="app"', false)
                ->assertSee('Slink');
        }
    }
}
