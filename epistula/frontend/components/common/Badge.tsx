import styles from './Badge.module.css';

interface BadgeProps {
  variant: 'active' | 'inactive' | 'completed' | 'withdrawn' | 'administrator' | 'professor' | 'student';
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ variant, children, className }: BadgeProps) {
  const classes = [
    styles.badge,
    styles[variant],
    className
  ].filter(Boolean).join(' ');

  return <span className={classes}>{children}</span>;
}
