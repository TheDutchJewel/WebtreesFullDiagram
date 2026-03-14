<?php

/**
 * Full Diagram module for webtrees.
 *
 * @license GPL-3.0-or-later
 */

declare(strict_types=1);

namespace FullDiagram;

use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Menu;
use Fisharebest\Webtrees\Module\AbstractModule;
use Fisharebest\Webtrees\Module\ModuleChartInterface;
use Fisharebest\Webtrees\Module\ModuleChartTrait;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Module\ModuleCustomTrait;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Validator;
use Fisharebest\Webtrees\View;
use FullDiagram\Facade\DataFacade;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class Module extends AbstractModule implements ModuleChartInterface, ModuleCustomInterface, RequestHandlerInterface
{
    use ModuleChartTrait;
    use ModuleCustomTrait;

    public const ROUTE_NAME = 'full-diagram';
    public const ROUTE_URL  = '/tree/{tree}/full-diagram/{xref}';

    private const DEFAULT_ANCESTOR_GENERATIONS   = 3;
    private const DEFAULT_DESCENDANT_GENERATIONS = 3;
    private const MINIMUM_GENERATIONS            = 1;
    private const MAXIMUM_GENERATIONS            = 10;

    public function title(): string
    {
        return I18N::translate('Full Diagram');
    }

    public function description(): string
    {
        return I18N::translate('An interactive diagram showing ancestors, descendants, and siblings.');
    }

    public function customModuleAuthorName(): string
    {
        return 'Alex';
    }

    public function customModuleVersion(): string
    {
        return '0.1.0';
    }

    public function customModuleSupportUrl(): string
    {
        return '';
    }

    public function resourcesFolder(): string
    {
        return __DIR__ . '/../resources/';
    }

    public function boot(): void
    {
        View::registerNamespace($this->name(), $this->resourcesFolder() . 'views/');

        Registry::routeFactory()->routeMap()
            ->get(self::ROUTE_NAME, self::ROUTE_URL, $this)
            ->allows(RequestMethodInterface::METHOD_POST);
    }

    public function chartMenuClass(): string
    {
        return 'menu-chart-full-diagram';
    }

    public function chartBoxMenu(Individual $individual): Menu|null
    {
        return $this->chartMenu($individual);
    }

    public function chartUrl(Individual $individual, array $parameters = []): string
    {
        return route(self::ROUTE_NAME, [
                'tree' => $individual->tree()->name(),
                'xref' => $individual->xref(),
            ] + $parameters);
    }

    public function chartTitle(Individual $individual): string
    {
        return I18N::translate('Full Diagram of %s', $individual->fullName());
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree       = Validator::attributes($request)->tree();
        $xref       = Validator::attributes($request)->isXref()->string('xref');
        $individual = Registry::individualFactory()->make($xref, $tree);
        $individual = Auth::checkIndividualAccess($individual, false, true);

        // Redirect POST to GET for clean URLs
        if ($request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $params = (array) $request->getParsedBody();

            return redirect($this->chartUrl($individual, [
                'ancestor_generations'   => $params['ancestor_generations'] ?? self::DEFAULT_ANCESTOR_GENERATIONS,
                'descendant_generations' => $params['descendant_generations'] ?? self::DEFAULT_DESCENDANT_GENERATIONS,
                'show_siblings'          => $params['show_siblings'] ?? '1',
            ]));
        }

        $ancestorGenerations   = Validator::queryParams($request)
            ->isBetween(self::MINIMUM_GENERATIONS, self::MAXIMUM_GENERATIONS)
            ->integer('ancestor_generations', self::DEFAULT_ANCESTOR_GENERATIONS);

        $descendantGenerations = Validator::queryParams($request)
            ->isBetween(self::MINIMUM_GENERATIONS, self::MAXIMUM_GENERATIONS)
            ->integer('descendant_generations', self::DEFAULT_DESCENDANT_GENERATIONS);

        $showSiblings = Validator::queryParams($request)
            ->string('show_siblings', '1') === '1';

        // Check for AJAX request
        $ajax = Validator::queryParams($request)->string('ajax', '') === '1';

        $configuration = new Configuration(
            $ancestorGenerations,
            $descendantGenerations,
            $showSiblings,
        );

        $dataFacade = new DataFacade();
        $treeData   = $dataFacade->buildFullTree($individual, $configuration);

        if ($ajax) {
            return response([
                'data' => $treeData,
            ]);
        }

        return $this->viewResponse($this->name() . '::modules/full-diagram/page', [
            'title'                  => $this->chartTitle($individual),
            'individual'             => $individual,
            'module'                 => $this,
            'tree'                   => $tree,
            'configuration'          => $configuration,
            'tree_data'              => json_encode($treeData, JSON_THROW_ON_ERROR),
            'javascript_url'         => $this->assetUrl('js/full-diagram.min.js'),
            'stylesheet_url'         => $this->assetUrl('css/full-diagram.css'),
            'ancestor_generations'   => $ancestorGenerations,
            'descendant_generations' => $descendantGenerations,
            'show_siblings'          => $showSiblings,
            'max_generations'        => self::MAXIMUM_GENERATIONS,
            'min_generations'        => self::MINIMUM_GENERATIONS,
        ]);
    }
}
