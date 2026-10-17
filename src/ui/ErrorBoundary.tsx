/**
 * 全局与组件级 React 错误边界（Error Boundary）。
 * 捕获子组件渲染期间的不可预期异常，展示优雅的降级 UI 并支持重试，防止整屏白屏。
 */

import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Buttons';
import { colors, radius, sizing, spacing, typography } from './tokens';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  title?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.header}>
              <AlertTriangle size={sizing[20]} color={colors.danger} />
              <Text style={styles.title}>{this.props.title ?? '组件显示异常'}</Text>
            </View>
            <Text style={styles.message} numberOfLines={3}>
              {this.state.error.message || '发生未知错误'}
            </Text>
            <View style={styles.actions}>
              <Button small icon={RefreshCw} onPress={this.reset}>
                重试
              </Button>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.dangerBg,
    borderWidth: sizing.borderWidth,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.text,
    fontWeight: '600',
    color: colors.danger,
  },
  message: {
    ...typography.small,
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
});
