import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '../shared/theme';
import { ListRowProps } from './ListRow';

export interface ListSectionProps {
  /**
   * `borderless`: rows directly on the screen background, hairlines inset
   * 22px between rows. `panel`: rows inside a `panel` card (1px `line`
   * border, 22px radius, screen margins), hairlines inset 18px.
   */
  variant: 'borderless' | 'panel';
  /** ListRow children; separators are injected between them. */
  children: React.ReactNode;
}

/**
 * Grouped list container per docs/design/design-style.md: injects 1px
 * hairlines between rows (never above the first) and, in the panel variant,
 * switches rows to dense padding.
 */
export function ListSection({ variant, children }: ListSectionProps) {
  const panel = variant === 'panel';
  const rows = React.Children.toArray(children);
  return (
    <View style={panel ? styles.panel : styles.borderless}>
      {rows.map((child, i) => (
        <React.Fragment key={(child as React.ReactElement)?.key ?? i}>
          {i > 0 ? (
            <View
              testID="list-section-separator"
              style={[styles.separator, panel ? styles.sepPanel : styles.sepBorderless]}
            />
          ) : null}
          {panel && React.isValidElement<ListRowProps>(child)
            ? React.cloneElement(child, { dense: child.props.dense ?? true })
            : child}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  borderless: {},
  panel: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.panel,
    marginHorizontal: spacing.screenMargin,
    overflow: 'hidden',
  },
  separator: { height: 1, backgroundColor: colors.line },
  sepBorderless: { marginLeft: 22 },
  sepPanel: { marginLeft: 18 },
});
