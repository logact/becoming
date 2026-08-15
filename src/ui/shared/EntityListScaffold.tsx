import React from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, fonts, radius, spacing } from './theme';

export type EntityListStatus = 'loading' | 'error' | 'ready';
export type EntityListFilter = 'active' | 'archived';

export interface EntityListScaffoldProps<T> {
  /** Destination title, e.g. 'Goals'. */
  title: string;
  /** Hero heading and supporting copy (prototype planning hero). */
  heroTitle: string;
  heroCopy: string;
  heroKicker?: string;
  searchPlaceholder: string;

  /** Read state of the backing query. */
  status: EntityListStatus;
  /** Human-readable failure copy; rendered with a Retry action. */
  errorMessage?: string;
  onRetry?: () => void;

  items: T[];
  keyExtractor: (item: T) => string;
  /** Row content for one item; the scaffold supplies layout and keys. */
  renderRow: (item: T) => ReactNode;

  filter: EntityListFilter;
  onFilterChange: (filter: EntityListFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;

  /** Explicit empty state shown when a ready list has no rows. */
  emptyTitle: string;
  emptyMessage: string;

  /**
   * Create action, shown only on the Active filter when the list is ready.
   * Archived views stay read-only and expose no create action.
   */
  createLabel?: string;
  onCreate?: () => void;
}

/**
 * Shared entity list scaffold for the Goals, Projects, and Tasks
 * destinations: planning hero, an inline toolbar with title search and an
 * Active/Archived filter toggle, grouped list rows with separators, explicit
 * empty state, loading state, recoverable error/retry state, and an
 * active-only lime square create button. Presentation only — screens own the
 * query, filtering, and mutations.
 */
export function EntityListScaffold<T>(props: EntityListScaffoldProps<T>) {
  const {
    title, heroTitle, heroCopy, heroKicker = 'Becoming',
    searchPlaceholder, status, errorMessage, onRetry,
    items, keyExtractor, renderRow,
    filter, onFilterChange, searchQuery, onSearchChange,
    emptyTitle, emptyMessage, createLabel, onCreate,
  } = props;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View
            style={styles.heroOrnament}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={styles.heroKicker} maxFontSizeMultiplier={2}>
            {heroKicker}
          </Text>
          <Text style={styles.heroTitle} maxFontSizeMultiplier={2}>
            {heroTitle}
          </Text>
          <Text style={styles.heroCopy} maxFontSizeMultiplier={2}>
            {heroCopy}
          </Text>
        </View>

        <View style={styles.toolbar}>
          <TextInput
            style={styles.search}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.muted}
            accessibilityLabel={searchPlaceholder}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            onPress={() => onFilterChange(filter === 'active' ? 'archived' : 'active')}
            accessibilityRole="button"
            accessibilityLabel={
              filter === 'active'
                ? `Show archived ${title.toLowerCase()}`
                : `Show active ${title.toLowerCase()}`
            }
            style={styles.filterToggle}
          >
            <Text style={styles.filterToggleText} maxFontSizeMultiplier={2}>
              {filter === 'active' ? 'Active' : 'Archived'} ⌄
            </Text>
          </Pressable>
        </View>

        {status === 'loading' && (
          <View style={styles.stateBlock} accessibilityLabel={`Loading ${title.toLowerCase()}`}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.stateText}>Loading {title.toLowerCase()}…</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.stateBlock}>
            <Text style={styles.errorIcon} accessibilityElementsHidden importantForAccessibility="no">
              !
            </Text>
            <Text style={styles.stateTitle}>{title} unavailable</Text>
            <Text style={styles.stateText}>
              {errorMessage ?? 'The list could not be loaded. No changes were made.'}
            </Text>
            {onRetry && (
              <Pressable
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel={`Retry loading ${title.toLowerCase()}`}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}

        {status === 'ready' && items.length === 0 && (
          <View style={styles.stateBlock}>
            <Text style={styles.stateTitle}>{emptyTitle}</Text>
            <Text style={styles.stateText}>{emptyMessage}</Text>
          </View>
        )}

        {status === 'ready' && items.length > 0 && (
          <View style={styles.rows}>
            {items.map((item, index) => (
              <View
                key={keyExtractor(item)}
                style={[styles.row, index === items.length - 1 && styles.rowLast]}
              >
                {renderRow(item)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {status === 'ready' && filter === 'active' && onCreate && createLabel && (
        <Pressable
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel={createLabel}
          style={styles.fab}
        >
          <Text
            style={styles.fabIcon}
            accessibilityElementsHidden
            importantForAccessibility="no"
            maxFontSizeMultiplier={2}
          >
            ＋
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 4,
  },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius.sheet,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroOrnament: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.lime,
    opacity: 0.84,
    right: -60,
    top: -56,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: '#c8ddd5',
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '500',
    color: colors.white,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroCopy: {
    fontSize: 13,
    lineHeight: 19,
    color: '#c8d7d2',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  search: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
  filterToggle: {
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  stateBlock: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorIcon: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.red,
  },
  stateTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
  rows: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#365246',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 6,
  },
  fabIcon: {
    color: colors.ink,
    fontWeight: '400',
    fontSize: 28,
    lineHeight: 32,
  },
});
