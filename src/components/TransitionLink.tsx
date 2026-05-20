import { Link, useNavigate, type LinkProps } from "react-router-dom";
import { navigateWithTransition } from "../lib/motion/viewTransition";

export default function TransitionLink(props: LinkProps) {
  const navigate = useNavigate();
  const { to, onClick, ...rest } = props;

  return (
    <Link
      {...rest}
      to={to}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented) return;
        if (typeof to !== "string") return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigateWithTransition(navigate, to);
      }}
    />
  );
}
