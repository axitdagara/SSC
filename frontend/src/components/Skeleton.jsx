import React from 'react';
import styles from './skeleton.module.css';

export function SkeletonBox({ width = '100%', height = '20px', marginBottom = '12px', borderRadius = '8px' }) {
  return (
    <div
      className={styles.skeleton}
      style={{
        width,
        height,
        marginBottom,
        borderRadius,
      }}
    />
  );
}

export function SkeletonCard({ className = '', children = null }) {
  return (
    <div className={`${styles.skeletonCard} ${className}`}>
      {children || (
        <>
          <SkeletonBox height="24px" marginBottom="16px" />
          <SkeletonBox height="16px" marginBottom="8px" />
          <SkeletonBox height="16px" marginBottom="8px" width="80%" />
        </>
      )}
    </div>
  );
}

export function SkeletonText({ lines = 3, width = '100%' }) {
  return (
    <>
      {Array(lines).fill(null).map((_, i) => (
        <SkeletonBox
          key={i}
          width={i === lines - 1 ? '80%' : width}
          height="16px"
          marginBottom="8px"
        />
      ))}
    </>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {Array(4).fill(null).map((_, i) => (
          <SkeletonCard key={i}>
            <SkeletonBox height="16px" marginBottom="12px" width="60%" />
            <SkeletonBox height="32px" marginBottom="8px" />
            <SkeletonBox height="12px" width="70%" />
          </SkeletonCard>
        ))}
      </div>

      {/* Featured Players */}
      <div style={{ marginBottom: '32px' }}>
        <SkeletonBox height="24px" marginBottom="16px" width="30%" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {Array(3).fill(null).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {Array(2).fill(null).map((_, i) => (
          <SkeletonCard key={i}>
            <SkeletonBox height="300px" marginBottom="0" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export function PlayersPageSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      {/* Filters and Search */}
      <div style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {Array(4).fill(null).map((_, i) => (
          <SkeletonBox key={i} height="40px" marginBottom="0" />
        ))}
      </div>

      {/* Players List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
        {Array(8).fill(null).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function FinancePageSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {Array(3).fill(null).map((_, i) => (
          <SkeletonCard key={i}>
            <SkeletonBox height="16px" marginBottom="12px" width="60%" />
            <SkeletonBox height="32px" marginBottom="8px" />
            <SkeletonBox height="12px" width="70%" />
          </SkeletonCard>
        ))}
      </div>

      {/* Transactions List */}
      <div>
        <SkeletonBox height="24px" marginBottom="16px" width="30%" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array(5).fill(null).map((_, i) => (
            <SkeletonBox key={i} height="60px" marginBottom="0" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {Array(4).fill(null).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Users Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SkeletonBox height="20px" marginBottom="16px" width="30%" />
        {Array(10).fill(null).map((_, i) => (
          <SkeletonBox key={i} height="50px" marginBottom="0" />
        ))}
      </div>
    </div>
  );
}

export function MatchesPageSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      {/* Matches List */}
      <SkeletonBox height="24px" marginBottom="16px" width="30%" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        {Array(5).fill(null).map((_, i) => (
          <SkeletonBox key={i} height="80px" marginBottom="0" />
        ))}
      </div>

      {/* Scoreboard */}
      <div>
        <SkeletonBox height="24px" marginBottom="16px" width="30%" />
        <SkeletonCard>
          <SkeletonBox height="300px" marginBottom="0" />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      {/* Profile Header */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', alignItems: 'center' }}>
        <SkeletonBox width="120px" height="120px" borderRadius="50%" marginBottom="0" />
        <div style={{ flex: 1 }}>
          <SkeletonBox height="32px" marginBottom="12px" width="50%" />
          <SkeletonBox height="16px" marginBottom="8px" width="70%" />
          <SkeletonBox height="16px" marginBottom="0" width="40%" />
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {Array(6).fill(null).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Tabs Content */}
      <div>
        <SkeletonBox height="20px" marginBottom="16px" width="30%" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array(3).fill(null).map((_, i) => (
            <SkeletonBox key={i} height="60px" marginBottom="0" />
          ))}
        </div>
      </div>
    </div>
  );
}
