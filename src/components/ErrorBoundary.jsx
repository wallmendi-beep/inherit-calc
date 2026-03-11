import React from 'react';

/**
 * React 런타임 에러를 잡아 화면에 표시하는 에러 바운더리
 * 개발 디버깅용
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '32px', fontFamily: 'monospace',
          zIndex: 9999, overflow: 'auto'
        }}>
          <div style={{ maxWidth: '800px', width: '100%' }}>
            <h2 style={{ color: '#c93f3a', fontSize: '20px', marginBottom: '16px' }}>
              🚨 앱 오류가 발생했습니다
            </h2>
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '16px', whiteSpace: 'pre-wrap', fontSize: '13px', color: '#7f1d1d' }}>
              {this.state.error?.toString()}
            </div>
            <div style={{ background: '#f7f7f5', border: '1px solid #e9e9e7', borderRadius: '8px', padding: '16px', whiteSpace: 'pre-wrap', fontSize: '12px', color: '#504f4c', maxHeight: '300px', overflow: 'auto' }}>
              {this.state.info?.componentStack}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null, info: null })}
              style={{ marginTop: '16px', background: '#2383e2', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
            >
              초기화 후 재시도
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
