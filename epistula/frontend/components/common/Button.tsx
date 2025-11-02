import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'medium',
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    className
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
