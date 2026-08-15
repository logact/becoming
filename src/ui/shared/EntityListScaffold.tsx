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

import { colors, radius, spacing } from './theme';

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
 * destinations: planning hero, title search, Active/Archived segmented
 * filter, populated rows, explicit empty state, loading state, recoverable
 * error/retry state, and an active-only create action. Presentation only —
 * screens own the query, filtering, and mutations.
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
          <View
            style={styles.segment}
            accessibilityRole="tablist"
            accessibilityLabel={`${title} status filter`}
          >
            {(['active', 'archived'] as const).map((option) => {
              const selected = filter === option;
              const label = option === 'active' ? 'Active' : 'Archived';
              return (
                <Pressable
                  key={option}
                  onPress={() => onFilterChange(option)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Show ${label.toLowerCase()} ${title.toLowerCase()}`}
                  style={[styles.segmentOption, selected && styles.segmentOptionSelected]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
            {items.map((item) => (
              <View key={keyExtractor(item)} style={styles.row}>
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
          style={styles.createButton}
        >
          <Text style={styles.createText}>{createLabel}</Text>
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
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: '#c8ddd5',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '600',
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
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  search: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.badge,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xs,
    alignSelf: 'flex-start',
  },
  segmentOption: {
    borderRadius: radius.badge,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  segmentOptionSelected: {
    backgroundColor: colors.ink,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextSelected: {
    color: colors.white,
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
    fontSize: 16,
    fontWeight: '700',
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
    gap: spacing.md,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  createButton: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.brand,
    borderRadius: radius.badge,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  createText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
