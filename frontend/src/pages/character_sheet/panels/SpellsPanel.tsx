import { characterState } from '@atoms/characterAtoms';
import { drawerState } from '@atoms/navAtoms';
import { ActionSymbol } from '@common/Actions';
import TokenSelect from '@common/TokenSelect';
import { collectEntitySpellcasting } from '@content/collect-content';
import { fetchContentAll } from '@content/content-store';
import {
  Accordion,
  ActionIcon,
  Box,
  CloseButton,
  Group,
  HoverCard,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  useMantineTheme,
} from '@mantine/core';
import ManageSpellsModal from '@modals/ManageSpellsModal';
import { isCantrip } from '@spells/spell-utils';
import { IconSearch, IconSquareRounded, IconSquareRoundedFilled } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { ActionCost, CastingSource, Spell, SpellInnateEntry, SpellListEntry, SpellSlot } from '@typing/content';
import useRefresh from '@utils/use-refresh';
import * as JsSearch from 'js-search';
import _ from 'lodash-es';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import FocusSpellsList from './spells_list/FocusSpellsList';
import InnateSpellsList from './spells_list/InnateSpellsList';
import PreparedSpellsList from './spells_list/PreparedSpellsList';
import RitualSpellsList from './spells_list/RitualSpellsList';
import SpontaneousSpellsList from './spells_list/SpontaneousSpellsList';

export default function SpellsPanel(props: { panelHeight: number; panelWidth: number }) {
  const theme = useMantineTheme();
  const character = useRecoilValue(characterState);
  const [searchQuery, setSearchQuery] = useState('');
  const [_drawer, openDrawer] = useRecoilState(drawerState);
  const [section, setSection] = useState<string>();
  const [manageSpells, setManageSpells] = useState<
    | {
        source: string;
        type: 'SLOTS-ONLY' | 'SLOTS-AND-LIST' | 'LIST-ONLY';
        filter?: {
          traditions?: string[];
          ranks?: string[];
        };
      }
    | undefined
  >();

  const { data: spells } = useQuery({
    queryKey: [`find-spells-and-data`],
    queryFn: async () => {
      if (!character) return null;

      return await fetchContentAll<Spell>('spell');
    },
  });

  const charData = useMemo(() => {
    if (!character) return null;
    return collectEntitySpellcasting('CHARACTER', character);
  }, [character]);

  // Filter options based on search query
  const search = useRef(new JsSearch.Search('id'));
  useEffect(() => {
    if (!spells) return;
    search.current.addIndex('name');
    search.current.addIndex('description');
    search.current.addIndex('duration');
    search.current.addIndex('targets');
    search.current.addIndex('area');
    search.current.addIndex('range');
    search.current.addIndex('requirements');
    search.current.addIndex('trigger');
    search.current.addIndex('cost');
    search.current.addIndex('defense');
    search.current.addDocuments(spells);
  }, [spells]);

  // Filter spells by action cost
  const [actionTypeFilter, setActionTypeFilter] = useState<ActionCost | 'ALL'>('ALL');

  const searchSpells = searchQuery.trim() ? (search.current?.search(searchQuery.trim()) as Spell[]) : spells ?? [];
  const allSpells = searchSpells.filter((spell) => spell.cast === actionTypeFilter || actionTypeFilter === 'ALL');
  const hasFilters = searchQuery.trim().length > 0 || actionTypeFilter !== 'ALL';

  return (
    <Box h='100%'>
      <Stack gap={10}>
        <Group>
          <TextInput
            style={{ flex: 1 }}
            leftSection={<IconSearch size='0.9rem' />}
            placeholder={`Search spells`}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            rightSection={
              <CloseButton
                aria-label='Clear input'
                onClick={() => setSearchQuery('')}
                style={{ display: searchQuery.trim() ? undefined : 'none' }}
              />
            }
            styles={{
              input: {
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderColor: searchQuery.trim().length > 0 ? theme.colors['guide'][8] : undefined,
              },
            }}
          />
          <ActionFilter actionTypeFilter={actionTypeFilter} setActionTypeFilter={setActionTypeFilter} />
          {/* <SegmentedControl
            value={section}
            onChange={setSection}
            disabled={!!searchQuery.trim()}
            data={[
              { label: 'Spells', value: 'NORMAL' },
              { label: 'Focus', value: 'FOCUS' },
              { label: 'Innate', value: 'INNATE' },
            ].filter((section) => {
              if (!data) return false;

              if (section.value === 'FOCUS') {
                return data.data.focus.length > 0;
              }
              if (section.value === 'INNATE') {
                return data.data.innate.length > 0;
              }
              if (section.value === 'NORMAL') {
                return data.data.slots.length > 0;
              }
            })}
          /> */}
        </Group>
        <ScrollArea h={props.panelHeight - 50} scrollbars='y'>
          {charData && (
            <Accordion
              data-wg-name='spells-accordion'
              variant='separated'
              multiple
              defaultValue={[
                ...charData.sources.map((source) => `spontaneous-${source.name}`),
                ...charData.sources.map((source) => `prepared-${source.name}`),
                ...charData.sources.map((source) => `focus-${source.name}`),
                'innate',
                // 'ritual',
              ]}
              styles={{
                label: {
                  paddingTop: 5,
                  paddingBottom: 5,
                },
                control: {
                  paddingLeft: 13,
                  paddingRight: 13,
                },
                item: {
                  marginTop: 0,
                  marginBottom: 10,
                },
              }}
            >
              {charData.sources.map((source, index) => (
                <div key={index}>
                  {source.type.startsWith('SPONTANEOUS-') ? (
                    <>
                      {
                        <SpellList
                          index={`spontaneous-${source.name}`}
                          source={source}
                          spellIds={charData.list.filter((d) => d.source === source.name).map((d) => d.spell_id)}
                          allSpells={allSpells}
                          type='SPONTANEOUS'
                          extra={{ slots: charData.slots.filter((s) => s.source === source.name), charData: charData }}
                          openManageSpells={(source, type, filter) => setManageSpells({ source, type, filter })}
                          hasFilters={hasFilters}
                        />
                      }
                    </>
                  ) : source.type.startsWith('PREPARED-') ? (
                    <>
                      {
                        <SpellList
                          index={`prepared-${source.name}`}
                          source={source}
                          spellIds={charData.list.filter((d) => d.source === source.name).map((d) => d.spell_id)}
                          allSpells={allSpells}
                          type='PREPARED'
                          extra={{ slots: charData.slots.filter((s) => s.source === source.name), charData: charData }}
                          openManageSpells={(source, type, filter) => setManageSpells({ source, type, filter })}
                          hasFilters={hasFilters}
                        />
                      }
                    </>
                  ) : null}
                  {charData.focus.filter((d) => d.source === source.name).length > 0 && (
                    <SpellList
                      index={`focus-${source.name}`}
                      source={source}
                      spellIds={charData.focus.filter((d) => d.source === source.name).map((d) => d.spell_id)}
                      allSpells={allSpells}
                      type='FOCUS'
                      hasFilters={hasFilters}
                      extra={{ charData: charData }}
                    />
                  )}
                </div>
              ))}

              {charData.innate.length > 0 && (
                <SpellList
                  index={'innate'}
                  spellIds={charData.innate.map((d) => d.spell_id)}
                  allSpells={allSpells}
                  type='INNATE'
                  extra={{ innates: charData.innate, charData: charData }}
                  hasFilters={hasFilters}
                />
              )}
              {/* Always display ritual section */}
              {true && (
                <SpellList
                  index={'ritual'}
                  spellIds={charData.list.filter((d) => d.source === 'RITUALS').map((d) => d.spell_id)}
                  allSpells={allSpells}
                  type='RITUAL'
                  openManageSpells={(source, type) => setManageSpells({ source, type })}
                  hasFilters={hasFilters}
                  extra={{ charData: charData }}
                />
              )}
            </Accordion>
          )}
        </ScrollArea>
      </Stack>
      {manageSpells && (
        <ManageSpellsModal
          opened={!!manageSpells}
          onClose={() => setManageSpells(undefined)}
          source={manageSpells.source}
          type={manageSpells.type}
          filter={manageSpells.filter}
        />
      )}
    </Box>
  );
}

function ActionFilter(props: {
  actionTypeFilter: 'ALL' | ActionCost;
  setActionTypeFilter: (v: 'ALL' | ActionCost) => void;
}) {
  const { actionTypeFilter, setActionTypeFilter } = props;
  const theme = useMantineTheme();

  return (
    <Group gap={5}>
      <ActionIcon
        variant='subtle'
        color='dark'
        radius='xl'
        size='lg'
        aria-label='Filter One Action'
        style={{
          backgroundColor: actionTypeFilter === 'ALL' ? theme.colors.dark[6] : undefined,
          borderColor: actionTypeFilter === 'ALL' ? theme.colors.dark[4] : undefined,
        }}
        onClick={() => {
          setActionTypeFilter('ALL');
        }}
      >
        <Text c='gray.3'>All</Text>
      </ActionIcon>
      <ActionIcon
        variant='subtle'
        color='dark'
        radius='xl'
        size='lg'
        aria-label='Filter One Action'
        style={{
          backgroundColor: actionTypeFilter === 'ONE-ACTION' ? theme.colors.dark[6] : undefined,
          borderColor: actionTypeFilter === 'ONE-ACTION' ? theme.colors['guide'][8] : undefined,
        }}
        onClick={() => {
          setActionTypeFilter('ONE-ACTION');
        }}
      >
        <ActionSymbol cost={'ONE-ACTION'} size={'1.9rem'} />
      </ActionIcon>
      <ActionIcon
        variant='subtle'
        color='dark'
        radius='xl'
        size='lg'
        aria-label='Filter Two Actions'
        style={{
          backgroundColor: actionTypeFilter === 'TWO-ACTIONS' ? theme.colors.dark[6] : undefined,
          borderColor: actionTypeFilter === 'TWO-ACTIONS' ? theme.colors['guide'][8] : undefined,
        }}
        onClick={() => {
          setActionTypeFilter('TWO-ACTIONS');
        }}
      >
        <ActionSymbol cost={'TWO-ACTIONS'} size={'1.9rem'} />
      </ActionIcon>
      <ActionIcon
        variant='subtle'
        color='dark'
        radius='xl'
        size='lg'
        aria-label='Filter Three Actions'
        style={{
          backgroundColor: actionTypeFilter === 'THREE-ACTIONS' ? theme.colors.dark[6] : undefined,
          borderColor: actionTypeFilter === 'THREE-ACTIONS' ? theme.colors['guide'][8] : undefined,
        }}
        onClick={() => {
          setActionTypeFilter('THREE-ACTIONS');
        }}
      >
        <ActionSymbol cost={'THREE-ACTIONS'} size={'1.9rem'} />
      </ActionIcon>
      <ActionIcon
        variant='subtle'
        color='dark'
        radius='xl'
        size='lg'
        aria-label='Filter Free Action'
        style={{
          backgroundColor: actionTypeFilter === 'FREE-ACTION' ? theme.colors.dark[6] : undefined,
          borderColor: actionTypeFilter === 'FREE-ACTION' ? theme.colors['guide'][8] : undefined,
        }}
        onClick={() => {
          setActionTypeFilter('FREE-ACTION');
        }}
      >
        <ActionSymbol cost={'FREE-ACTION'} size={'1.9rem'} />
      </ActionIcon>
      <ActionIcon
        variant='subtle'
        color='dark'
        radius='xl'
        size='lg'
        aria-label='Filter Reaction'
        style={{
          backgroundColor: actionTypeFilter === 'REACTION' ? theme.colors.dark[6] : undefined,
          borderColor: actionTypeFilter === 'REACTION' ? theme.colors['guide'][8] : undefined,
        }}
        onClick={() => {
          setActionTypeFilter('REACTION');
        }}
      >
        <ActionSymbol cost={'REACTION'} size={'1.9rem'} />
      </ActionIcon>
    </Group>
  );
}

function SpellList(props: {
  index: string;
  source?: CastingSource;
  spellIds: number[];
  allSpells: Spell[];
  type: 'PREPARED' | 'SPONTANEOUS' | 'FOCUS' | 'INNATE' | 'RITUAL';
  extra: {
    charData: {
      slots: SpellSlot[];
      list: SpellListEntry[];
      focus: {
        spell_id: number;
        source: string;
        rank: number | undefined;
      }[];
      innate: SpellInnateEntry[];
      sources: CastingSource[];
    };
    slots?: SpellSlot[];
    innates?: SpellInnateEntry[];
  };
  hasFilters: boolean;
  openManageSpells?: (
    source: string,
    type: 'SLOTS-ONLY' | 'SLOTS-AND-LIST' | 'LIST-ONLY',
    filter?: {
      traditions?: string[];
      ranks?: string[];
    }
  ) => void;
}) {
  const [character, setCharacter] = useRecoilState(characterState);

  const castSpell = (cast: boolean, spell: Spell) => {
    if (!character) return;

    if (isCantrip(spell)) {
      // Casting a cantrip doesn't change any spells state
      return;
    }

    if (props.type === 'PREPARED' && props.source) {
      setCharacter((c) => {
        if (!c) return c;
        const slots = collectEntitySpellcasting('CHARACTER', c).slots;
        const slotIndex = slots.findIndex(
          (slot) =>
            slot.spell_id === spell.id &&
            slot.rank === spell.rank &&
            slot.source === props.source!.name &&
            !!slot.exhausted == !cast
        );
        if (slotIndex === -1) return c; // Shouldn't happen
        const newSlots = [...slots];
        newSlots[slotIndex].exhausted = cast;
        return {
          ...c,
          spells: {
            ...(c.spells ?? {
              slots: [],
              list: [],
              focus_point_current: 0,
              innate_casts: [],
            }),
            slots: newSlots,
          },
        };
      });
    }

    if (props.type === 'SPONTANEOUS' && props.source) {
      setCharacter((c) => {
        if (!c) return c;
        let added = false;
        const newUpdatedSlots = collectEntitySpellcasting('CHARACTER', c).slots.map((slot) => {
          if (!added && slot.rank === spell.rank && slot.source === props.source!.name && !slot.exhausted === cast) {
            added = true;
            return {
              ...slot,
              exhausted: cast,
            };
          }
          return slot;
        });

        return {
          ...c,
          spells: {
            ...(c.spells ?? {
              slots: [],
              list: [],
              focus_point_current: 0,
              innate_casts: [],
            }),
            slots: newUpdatedSlots,
          },
        };
      });
    }

    if (props.type === 'FOCUS') {
      setCharacter((c) => {
        if (!c) return c;
        return {
          ...c,
          spells: {
            ...(c.spells ?? {
              slots: [],
              list: [],
              focus_point_current: 0,
              innate_casts: [],
            }),
            focus_point_current: Math.max((c.spells?.focus_point_current ?? 0) + (cast ? -1 : 1), 0),
          },
        };
      });
    }

    if (props.type === 'INNATE') {
      setCharacter((c) => {
        if (!c) return c;

        const innates = collectEntitySpellcasting('CHARACTER', c).innate.map((innate) => {
          if (innate.spell_id === spell.id && innate.rank === spell.rank) {
            return {
              ...innate,
              casts_current: cast
                ? Math.min(innate.casts_current + 1, innate.casts_max)
                : Math.max(innate.casts_current - 1, 0),
            };
          }
          return innate;
        });

        return {
          ...c,
          spells: {
            ...(c.spells ?? {
              slots: [],
              list: [],
              focus_point_current: 0,
              innate_casts: [],
            }),
            innate_casts: innates,
          },
        };
      });
    }
  };

  // Display spells in an ordered list by rank
  const spells = useMemo(() => {
    const filteredSpells = props.spellIds
      .map((id) => {
        const foundSpell = props.allSpells.find((spell) => spell.id === id);
        if (!foundSpell) return null;
        const entry = props.extra.charData.list.find((entry) => entry.spell_id === id);
        // Don't add spell if we have an entry for it because we're going to add it later
        if (entry && entry.source !== 'RITUALS') return null;
        return foundSpell;
      })
      .filter((spell) => spell) as Spell[];

    // Add spells from entries (for overridded ranks)
    if (props.type === 'PREPARED' || props.type === 'SPONTANEOUS') {
      for (const entry of props.extra.charData.list) {
        const foundSpell = props.allSpells.find((spell) => spell.id === entry.spell_id);
        if (foundSpell && props.spellIds.includes(foundSpell.id)) {
          filteredSpells.push({
            ...foundSpell,
            rank: entry.rank,
          });
        }
      }
    }

    return _.groupBy(filteredSpells, 'rank');
  }, [props.spellIds, props.allSpells]);

  const slots = useMemo(() => {
    if (!props.extra?.slots || props.extra.slots.length === 0) return null;

    const mappedSlots = props.extra.slots.map((slot) => {
      let spell = props.allSpells.find((spell) => spell.id === slot.spell_id);
      if (spell) {
        spell = {
          ...spell,
          rank: slot.rank,
        };
      }
      return {
        ...slot,
        spell: spell,
      };
    });
    return _.groupBy(mappedSlots, 'rank');
  }, [props.extra?.slots, props.allSpells]);

  const innateSpells = useMemo(() => {
    const filteredSpells = props.extra?.innates
      ?.map((innate) => {
        let spell = props.allSpells.find((spell) => spell.id === innate.spell_id);
        if (spell) {
          spell = {
            ...spell,
            rank: innate.rank,
          };
        }
        return {
          ...innate,
          spell: spell,
        };
      })
      .filter((innate) => innate.spell);
    return _.groupBy(filteredSpells, 'rank');
  }, [props.extra?.innates, props.allSpells]);

  if (props.type === 'PREPARED' && props.source) {
    return <PreparedSpellsList {...props} slots={slots} castSpell={castSpell} />;
  }

  if (props.type === 'SPONTANEOUS' && props.source) {
    return (
      <SpontaneousSpellsList
        {...props}
        slots={slots}
        castSpell={castSpell}
        spells={spells}
        setCharacter={setCharacter}
      />
    );
  }

  if (props.type === 'FOCUS' && props.source && character) {
    return (
      <FocusSpellsList
        {...props}
        castSpell={castSpell}
        spells={spells}
        character={character}
        setCharacter={setCharacter}
      />
    );
  }

  if (props.type === 'INNATE' && props.extra?.innates) {
    return (
      <InnateSpellsList {...props} castSpell={castSpell} innateSpells={innateSpells} setCharacter={setCharacter} />
    );
  }

  if (props.type === 'RITUAL') {
    return <RitualSpellsList {...props} spells={spells} castSpell={castSpell} />;
  }

  return null;
}

export function SpellSlotSelect(props: { current: number; max: number; onChange: (v: number) => void; text: string }) {
  const [displaySlots, refreshDisplaySlots] = useRefresh();

  useEffect(() => {
    refreshDisplaySlots();
  }, [props.current, props.max]);

  return (
    <Box pt={3} style={{ zIndex: 100 }}>
      {displaySlots && (
        <HoverCard width={280} shadow='md'>
          <HoverCard.Target>
            <TokenSelect
              count={props.max}
              value={props.current}
              onChange={props.onChange}
              size='xs'
              emptySymbol={
                <ActionIcon
                  variant='transparent'
                  color='gray.1'
                  aria-label='Spell Slot, Unused'
                  size='xs'
                  style={{ opacity: 0.7 }}
                >
                  <IconSquareRounded size='1rem' />
                </ActionIcon>
              }
              fullSymbol={
                <ActionIcon
                  variant='transparent'
                  color='gray.1'
                  aria-label='Spell Slot, Exhuasted'
                  size='xs'
                  style={{ opacity: 0.7 }}
                >
                  <IconSquareRoundedFilled size='1rem' />
                </ActionIcon>
              }
            />
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <Text size='sm'>
              {props.text}: {props.current}/{props.max}
            </Text>
          </HoverCard.Dropdown>
        </HoverCard>
      )}
    </Box>
  );
}
