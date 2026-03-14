<?php

declare(strict_types=1);

namespace FullDiagram\Model;

use Fisharebest\Webtrees\Individual;
use JsonSerializable;

class NodeData implements JsonSerializable
{
    private string  $xref;
    private string  $firstName;
    private string  $lastName;
    private string  $fullName;
    private string  $sex;
    private string  $birthDate;
    private string  $birthYear;
    private string  $birthPlace;
    private string  $deathDate;
    private string  $deathYear;
    private string  $deathPlace;
    private string  $baptismDate;
    private string  $marriageDate;
    private string  $occupation;
    private string  $residence;
    private bool    $isDead;
    private bool    $hasMoreAncestors = false;
    private bool    $hasMoreDescendants = false;
    private string  $thumbnailUrl;
    private string  $url;
    private bool    $isSibling;
    private bool    $isRoot;

    /** @var list<FamilyNode> Parent families (ancestor direction) */
    private array $parentFamilies = [];

    /** @var list<FamilyNode> Spouse families (descendant direction) */
    private array $families = [];

    /** @param list<FamilyNode> $parentFamilies */
    public function setParentFamilies(array $parentFamilies): void
    {
        $this->parentFamilies = $parentFamilies;
    }

    private function __construct()
    {
    }

    public static function fromIndividual(Individual $individual, bool $isSibling = false, bool $isRoot = false): self
    {
        $node = new self();

        $node->xref         = $individual->xref();
        $node->fullName     = str_replace('@N.N.', "\u{2026}", strip_tags($individual->fullName()));
        $node->sex          = $individual->sex();
        $node->isDead       = $individual->isDead();
        $node->thumbnailUrl = self::extractThumbnail($individual);
        $node->url          = $individual->url();
        $node->isSibling    = $isSibling;
        $node->isRoot       = $isRoot;

        // Parse first/last name from GEDCOM name parts
        // Filter out GEDCOM unknown-name placeholders like @N.N., @P.N.
        $names = $individual->getAllNames();
        $primaryName = $names[0] ?? [];
        $node->firstName = self::cleanGedcomName(trim($primaryName['givn'] ?? ''));
        $node->lastName  = self::cleanGedcomName(trim($primaryName['surn'] ?? ''));

        // Dates and places
        $node->birthDate    = self::extractDate($individual, 'BIRT');
        $node->birthYear    = self::extractYear($individual, 'BIRT');
        $node->birthPlace   = self::extractPlace($individual, 'BIRT');
        $node->deathDate    = self::extractDate($individual, 'DEAT');
        $node->deathYear    = self::extractYear($individual, 'DEAT');
        $node->deathPlace   = self::extractPlace($individual, 'DEAT');
        $node->baptismDate  = self::extractDate($individual, 'BAPM')
                           ?: self::extractDate($individual, 'CHR');
        $node->occupation   = self::extractFactValue($individual, 'OCCU');
        $node->residence    = self::extractFactValue($individual, 'RESI');

        // Marriage date from first spouse family
        $node->marriageDate = '';
        $spouseFamily = $individual->spouseFamilies()->first();
        if ($spouseFamily !== null) {
            $marriageFact = $spouseFamily->facts(['MARR'])->first();
            if ($marriageFact !== null && $marriageFact->date()->isOK()) {
                $node->marriageDate = strip_tags($marriageFact->date()->display());
            }
        }

        return $node;
    }

    /**
     * Replace GEDCOM unknown-name placeholders (@N.N., @P.N.) with empty string.
     */
    private static function cleanGedcomName(string $name): string
    {
        // @N.N. = nomen nescio (unknown surname), @P.N. = praenomen nescio (unknown given name)
        if (preg_match('/^@[A-Z]\.N\.$/', $name)) {
            return '';
        }

        return $name;
    }

    private static function extractDate(Individual $individual, string $tag): string
    {
        $fact = $individual->facts([$tag])->first();
        if ($fact === null) {
            return '';
        }

        $date = $fact->date();
        if (!$date->isOK()) {
            return '';
        }

        return strip_tags($date->display());
    }

    private static function extractYear(Individual $individual, string $tag): string
    {
        $fact = $individual->facts([$tag])->first();
        if ($fact === null) {
            return '';
        }

        $date = $fact->date();
        if (!$date->isOK()) {
            return '';
        }

        return (string) $date->minimumDate()->year();
    }

    private static function extractPlace(Individual $individual, string $tag): string
    {
        $fact = $individual->facts([$tag])->first();
        if ($fact === null) {
            return '';
        }

        $place = $fact->place();
        return $place->gedcomName();
    }

    private static function extractFactValue(Individual $individual, string $tag): string
    {
        $fact = $individual->facts([$tag])->first();
        if ($fact === null) {
            return '';
        }

        return trim($fact->value());
    }

    private static function extractThumbnail(Individual $individual): string
    {
        $media = $individual->findHighlightedMediaFile();
        if ($media === null) {
            return '';
        }

        return $media->imageUrl(80, 80, 'crop');
    }

    public function xref(): string
    {
        return $this->xref;
    }

    /** @param list<FamilyNode> $families */
    public function setFamilies(array $families): void
    {
        $this->families = $families;
    }

    public function setHasMoreAncestors(bool $value): void
    {
        $this->hasMoreAncestors = $value;
    }

    public function setHasMoreDescendants(bool $value): void
    {
        $this->hasMoreDescendants = $value;
    }

    public function jsonSerialize(): mixed
    {
        $data = [
            'xref'         => $this->xref,
            'firstName'    => $this->firstName,
            'lastName'     => $this->lastName,
            'fullName'     => $this->fullName,
            'sex'          => $this->sex,
            'birthDate'    => $this->birthDate,
            'birthYear'    => $this->birthYear,
            'birthPlace'   => $this->birthPlace,
            'deathDate'    => $this->deathDate,
            'deathYear'    => $this->deathYear,
            'deathPlace'   => $this->deathPlace,
            'baptismDate'  => $this->baptismDate,
            'marriageDate' => $this->marriageDate,
            'occupation'   => $this->occupation,
            'residence'    => $this->residence,
            'isDead'       => $this->isDead,
            'thumbnailUrl' => $this->thumbnailUrl,
            'url'          => $this->url,
            'isSibling'         => $this->isSibling,
            'isRoot'            => $this->isRoot,
            'hasMoreAncestors'  => $this->hasMoreAncestors,
            'hasMoreDescendants'=> $this->hasMoreDescendants,
        ];

        if ($this->parentFamilies !== []) {
            $data['parentFamilies'] = $this->parentFamilies;
        }

        if ($this->families !== []) {
            $data['families'] = $this->families;
        }

        return $data;
    }
}
