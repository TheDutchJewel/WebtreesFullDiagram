<?php

/**
 * Full Diagram module for webtrees.
 *
 * @license AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace FullDiagram;

use Composer\Autoload\ClassLoader;
use Fisharebest\Webtrees\Registry;

// Register PSR-4 autoloader for our namespace
$loader = new ClassLoader();
$loader->addPsr4('FullDiagram\\', __DIR__ . '/src');
$loader->register();

return Registry::container()->get(Module::class);
