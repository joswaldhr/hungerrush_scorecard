/* @ds-bundle: {"format":3,"namespace":"HungerRushDesignSystem_019e09","components":[{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"AvatarGroup","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/data-display/Badge.jsx"},{"name":"Chip","sourcePath":"components/data-display/Chip.jsx"},{"name":"Divider","sourcePath":"components/data-display/Divider.jsx"},{"name":"Tooltip","sourcePath":"components/data-display/Tooltip.jsx"},{"name":"Typography","sourcePath":"components/data-display/Typography.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"CircularProgress","sourcePath":"components/feedback/CircularProgress.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"LinearProgress","sourcePath":"components/feedback/LinearProgress.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"TextField","sourcePath":"components/forms/TextField.jsx"},{"name":"Breadcrumbs","sourcePath":"components/navigation/Breadcrumbs.jsx"},{"name":"Pagination","sourcePath":"components/navigation/Pagination.jsx"},{"name":"Stepper","sourcePath":"components/navigation/Stepper.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Accordion","sourcePath":"components/surfaces/Accordion.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"CardHeader","sourcePath":"components/surfaces/Card.jsx"},{"name":"CardMedia","sourcePath":"components/surfaces/Card.jsx"},{"name":"CardContent","sourcePath":"components/surfaces/Card.jsx"},{"name":"CardActions","sourcePath":"components/surfaces/Card.jsx"},{"name":"Paper","sourcePath":"components/surfaces/Paper.jsx"}],"sourceHashes":{"components/data-display/Avatar.jsx":"ddd3351a4677","components/data-display/Badge.jsx":"238dfd0de04f","components/data-display/Chip.jsx":"cf44a343c46d","components/data-display/Divider.jsx":"25da0b9b0da7","components/data-display/Tooltip.jsx":"1370594e277f","components/data-display/Typography.jsx":"2de43fe63c90","components/feedback/Alert.jsx":"d9092301e4c3","components/feedback/CircularProgress.jsx":"c989db2adba8","components/feedback/Dialog.jsx":"e366f2a5d1f6","components/feedback/LinearProgress.jsx":"d7a20ffba343","components/feedback/Skeleton.jsx":"e58a95123c64","components/forms/Button.jsx":"9a94cbb2cdb2","components/forms/Checkbox.jsx":"220797c27a23","components/forms/IconButton.jsx":"96b8188b373f","components/forms/Radio.jsx":"55b26b3957b2","components/forms/Select.jsx":"6f609633c5a1","components/forms/Switch.jsx":"5e664a86e923","components/forms/TextField.jsx":"4446378e8026","components/navigation/Breadcrumbs.jsx":"61f653d53429","components/navigation/Pagination.jsx":"1bacf581b48e","components/navigation/Stepper.jsx":"1ecf95efb7d3","components/navigation/Tabs.jsx":"347549f46ed0","components/surfaces/Accordion.jsx":"49bde31243bc","components/surfaces/Card.jsx":"d2b613ecc272","components/surfaces/Paper.jsx":"79a8070f4ba8","ui_kits/restaurant-manager/BrandMenusScreen.jsx":"82f7e52d85c9","ui_kits/restaurant-manager/DashboardScreen.jsx":"5b618dbd5aad","ui_kits/restaurant-manager/Sidebar.jsx":"8bc9646bed13","ui_kits/restaurant-manager/TopBar.jsx":"b89726ffa8b4","ui_kits/restaurant-manager/UsersScreen.jsx":"7e22fe24c993"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.HungerRushDesignSystem_019e09 = window.HungerRushDesignSystem_019e09 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data-display/Avatar.jsx
try { (() => {
/** Avatar — circular/rounded image, initials, or icon. */
function Avatar({
  src,
  alt,
  children,
  size = 40,
  variant = "circular",
  color,
  style
}) {
  const radius = variant === "rounded" ? "var(--hr-radius)" : variant === "square" ? 0 : "50%";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: radius,
      overflow: "hidden",
      backgroundColor: color || "var(--components-avatar-fill)",
      color: "#fff",
      fontFamily: "var(--font-family-base)",
      fontSize: size * 0.4,
      fontWeight: 400,
      flexShrink: 0,
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : typeof children === "string" ? children : children);
}

/** AvatarGroup — overlapping avatar stack with optional +N surplus. */
function AvatarGroup({
  children,
  max = 5,
  size = 40,
  spacing = 8
}) {
  const items = React.Children.toArray(children);
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      flexDirection: "row-reverse",
      paddingLeft: spacing
    }
  }, extra > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: "50%",
      marginLeft: -spacing,
      border: "2px solid var(--background-default)",
      backgroundColor: "var(--grey-300)",
      color: "var(--text-secondary)",
      fontFamily: "var(--font-family-base)",
      fontSize: size * 0.36
    }
  }, "+", extra), shown.slice().reverse().map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      marginLeft: -spacing,
      borderRadius: "50%",
      border: "2px solid var(--background-default)",
      display: "inline-flex"
    }
  }, c)));
}
Object.assign(__ds_scope, { Avatar, AvatarGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Badge.jsx
try { (() => {
/** Badge — small count/dot overlay on its child. */
function Badge({
  children,
  badgeContent,
  color = "primary",
  variant = "standard",
  max = 99,
  showZero = false,
  style
}) {
  const show = variant === "dot" || badgeContent != null && (badgeContent !== 0 || showZero);
  const content = typeof badgeContent === "number" && badgeContent > max ? `${max}+` : badgeContent;
  const isDot = variant === "dot";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      verticalAlign: "middle",
      ...style
    }
  }, children, show && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 0,
      right: 0,
      transform: "translate(50%,-50%)",
      minWidth: isDot ? 8 : 20,
      height: isDot ? 8 : 20,
      padding: isDot ? 0 : "0 6px",
      borderRadius: "var(--hr-radius-pill)",
      backgroundColor: `var(--${color}-main)`,
      color: `var(--${color}-contrasttext)`,
      fontFamily: "var(--font-family-base)",
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 1,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box"
    }
  }, isDot ? "" : content));
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Chip — compact element for tags, filters, selections. */
function Chip({
  label,
  color = "default",
  variant = "filled",
  size = "medium",
  onDelete,
  icon,
  avatar,
  style,
  ...rest
}) {
  const h = size === "small" ? 24 : 32;
  const filled = variant === "filled";
  const isDefault = color === "default";
  const bg = filled ? isDefault ? "var(--action-selected)" : `var(--${color}-main)` : "transparent";
  const fg = filled ? isDefault ? "var(--text-primary)" : `var(--${color}-contrasttext)` : isDefault ? "var(--text-primary)" : `var(--${color}-main)`;
  const border = !filled ? `1px solid ${isDefault ? "var(--components-chip-defaultenabledborder)" : `var(--${color}-main)`}` : "1px solid transparent";
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: h,
      padding: avatar ? "0 12px 0 4px" : "0 12px",
      borderRadius: "var(--hr-radius-pill)",
      backgroundColor: bg,
      color: fg,
      border,
      fontFamily: "var(--font-family-base)",
      fontSize: size === "small" ? 13 : 14,
      fontWeight: 400,
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), avatar, icon && /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: size === "small" ? 16 : 18
    }
  }, icon), label, onDelete && /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    onClick: onDelete,
    style: {
      fontSize: size === "small" ? 16 : 18,
      cursor: "pointer",
      opacity: 0.7,
      marginRight: -4
    }
  }, "cancel"));
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Chip.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Divider.jsx
try { (() => {
/** Divider — thin rule, horizontal or vertical, with optional centered text. */
function Divider({
  orientation = "horizontal",
  children,
  style
}) {
  if (orientation === "vertical") {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-block",
        width: 1,
        alignSelf: "stretch",
        backgroundColor: "var(--divider)",
        margin: "0 8px",
        ...style
      }
    });
  }
  if (children) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        ...style
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 1,
        backgroundColor: "var(--divider)"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-family-base)",
        fontSize: 14,
        color: "var(--text-secondary)"
      }
    }, children), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 1,
        backgroundColor: "var(--divider)"
      }
    }));
  }
  return /*#__PURE__*/React.createElement("hr", {
    style: {
      border: "none",
      height: 1,
      backgroundColor: "var(--divider)",
      margin: 0,
      ...style
    }
  });
}
Object.assign(__ds_scope, { Divider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Divider.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Tooltip.jsx
try { (() => {
const {
  useState
} = React;
/** Tooltip — hover label. */
function Tooltip({
  title,
  placement = "top",
  children
}) {
  const [show, setShow] = useState(false);
  const pos = {
    top: {
      bottom: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      marginBottom: 6
    },
    bottom: {
      top: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      marginTop: 6
    },
    left: {
      right: "100%",
      top: "50%",
      transform: "translateY(-50%)",
      marginRight: 6
    },
    right: {
      left: "100%",
      top: "50%",
      transform: "translateY(-50%)",
      marginLeft: 6
    }
  }[placement];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex"
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      zIndex: 20,
      ...pos,
      whiteSpace: "nowrap",
      backgroundColor: "var(--components-tooltip-fill)",
      color: "#fff",
      fontFamily: "var(--font-family-base)",
      fontSize: 11,
      fontWeight: 500,
      padding: "4px 8px",
      borderRadius: "var(--hr-radius)",
      pointerEvents: "none"
    }
  }, title));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Typography.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SCALE = {
  h1: {
    fontSize: 96,
    fontWeight: 300,
    lineHeight: 1.167,
    letterSpacing: "-1.5px"
  },
  h2: {
    fontSize: 60,
    fontWeight: 300,
    lineHeight: 1.2,
    letterSpacing: "-0.5px"
  },
  h3: {
    fontSize: 48,
    fontWeight: 400,
    lineHeight: 1.167
  },
  h4: {
    fontSize: 34,
    fontWeight: 400,
    lineHeight: 1.235,
    letterSpacing: "0.25px"
  },
  h5: {
    fontSize: 24,
    fontWeight: 400,
    lineHeight: 1.334
  },
  h6: {
    fontSize: 20,
    fontWeight: 500,
    lineHeight: 1.6,
    letterSpacing: "0.15px"
  },
  subtitle1: {
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.75,
    letterSpacing: "0.15px"
  },
  subtitle2: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.57,
    letterSpacing: "0.1px"
  },
  body1: {
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.15px"
  },
  body2: {
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.43,
    letterSpacing: "0.17px"
  },
  button: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.75,
    letterSpacing: "0.4px",
    textTransform: "uppercase"
  },
  caption: {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.66,
    letterSpacing: "0.4px"
  },
  overline: {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 2.66,
    letterSpacing: "1px",
    textTransform: "uppercase"
  }
};
const TAG = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  subtitle1: "h6",
  subtitle2: "h6",
  body1: "p",
  body2: "p",
  button: "span",
  caption: "span",
  overline: "span"
};

/** Typography — renders text in any MUI scale variant. */
function Typography({
  variant = "body1",
  color = "var(--text-primary)",
  gutterBottom = false,
  align,
  children,
  style,
  ...rest
}) {
  const Tag = TAG[variant] || "span";
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      fontFamily: "var(--font-family-base)",
      color,
      margin: 0,
      marginBottom: gutterBottom ? "0.35em" : 0,
      textAlign: align,
      ...SCALE[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Typography });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Typography.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
const ICONS = {
  success: "check_circle",
  info: "info",
  warning: "warning",
  error: "error"
};

/** Alert — contextual message banner. */
function Alert({
  severity = "info",
  variant = "standard",
  title,
  children,
  onClose,
  icon,
  style
}) {
  const mainBg = `var(--components-alert-${severity}-background)`;
  const color = `var(--components-alert-${severity}-color)`;
  const filledBg = `var(--${severity === "error" ? "error" : severity}-main)`;
  const styles = {
    standard: {
      backgroundColor: mainBg,
      color
    },
    filled: {
      backgroundColor: filledBg,
      color: "#fff"
    },
    outlined: {
      backgroundColor: "transparent",
      color,
      border: `1px solid var(--${severity}-main)`
    }
  }[variant];
  return /*#__PURE__*/React.createElement("div", {
    role: "alert",
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      padding: "6px 16px",
      borderRadius: "var(--hr-radius)",
      fontFamily: "var(--font-family-base)",
      fontSize: 14,
      lineHeight: 1.43,
      ...styles,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 22,
      marginTop: 1,
      color: variant === "filled" ? "#fff" : `var(--${severity}-main)`
    }
  }, icon ?? ICONS[severity]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: "1px 0"
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 500,
      fontSize: 16,
      marginBottom: 2
    }
  }, title), children), onClose && /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    onClick: onClose,
    style: {
      fontSize: 20,
      cursor: "pointer",
      opacity: 0.7,
      marginTop: 1
    }
  }, "close"));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/CircularProgress.jsx
try { (() => {
/** CircularProgress — spinning ring (determinate or indeterminate). */
function CircularProgress({
  value,
  size = 40,
  thickness = 3.6,
  color = "primary"
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const indeterminate = value == null;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      animation: indeterminate ? "hr-spin 1.4s linear infinite" : "none"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: `var(--${color}-main)`,
    strokeWidth: thickness,
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: indeterminate ? c * 0.7 : c * (1 - (value || 0) / 100),
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  })), /*#__PURE__*/React.createElement("style", null, `@keyframes hr-spin{100%{transform:rotate(360deg)}}`));
}
Object.assign(__ds_scope, { CircularProgress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/CircularProgress.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
/** Dialog — modal surface with backdrop. Render conditionally on `open`. */
function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 444,
  style
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--components-backdrop-fill)",
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth,
      backgroundColor: "var(--background-paper-elevation-24)",
      borderRadius: "var(--hr-radius)",
      boxShadow: "var(--hr-shadow-24)",
      overflow: "hidden",
      fontFamily: "var(--font-family-base)",
      ...style
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 24px",
      fontSize: 20,
      fontWeight: 500,
      color: "var(--text-primary)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: title ? "0 24px 20px" : 24,
      fontSize: 16,
      color: "var(--text-secondary)",
      lineHeight: 1.5
    }
  }, children), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 8,
      padding: "8px 16px 16px"
    }
  }, actions)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/LinearProgress.jsx
try { (() => {
/** LinearProgress — determinate or indeterminate bar. */
function LinearProgress({
  value,
  color = "primary",
  style
}) {
  const indeterminate = value == null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      height: 4,
      borderRadius: 4,
      overflow: "hidden",
      backgroundColor: `var(--${color}-states-outlinedborder)`,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: indeterminate ? "40%" : `${value}%`,
      backgroundColor: `var(--${color}-main)`,
      animation: indeterminate ? "hr-indeterminate 1.6s ease-in-out infinite" : "none",
      transition: "width .3s"
    }
  }), /*#__PURE__*/React.createElement("style", null, `@keyframes hr-indeterminate{0%{left:-40%}60%{left:100%}100%{left:100%}}`));
}
Object.assign(__ds_scope, { LinearProgress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/LinearProgress.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
/** Skeleton — loading placeholder. */
function Skeleton({
  variant = "text",
  width,
  height,
  style
}) {
  const dims = {
    text: {
      width: width ?? "100%",
      height: height ?? 16,
      borderRadius: 4,
      transform: "scale(1,0.7)"
    },
    rectangular: {
      width: width ?? "100%",
      height: height ?? 120,
      borderRadius: 0
    },
    rounded: {
      width: width ?? "100%",
      height: height ?? 120,
      borderRadius: "var(--hr-radius)"
    },
    circular: {
      width: width ?? 40,
      height: height ?? 40,
      borderRadius: "50%"
    }
  }[variant];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      backgroundColor: "var(--action-hover)",
      backgroundImage: "linear-gradient(90deg, transparent, rgba(0,0,0,0.04), transparent)",
      backgroundSize: "200% 100%",
      animation: "hr-skeleton 1.5s ease-in-out infinite",
      ...dims,
      ...style
    }
  }, /*#__PURE__*/React.createElement("style", null, `@keyframes hr-skeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HungerRush Button — MUI-style button.
 * variant: contained | outlined | text
 * color:   primary | secondary | error | warning | info | success | inherit
 * size:    small | medium | large
 */
function Button({
  children,
  variant = "contained",
  color = "primary",
  size = "medium",
  disabled = false,
  fullWidth = false,
  startIcon,
  endIcon,
  style,
  ...rest
}) {
  const pad = {
    small: "4px 10px",
    medium: "6px 16px",
    large: "8px 22px"
  }[size];
  const font = {
    small: 13,
    medium: 14,
    large: 15
  }[size];
  const main = `var(--${color}-main)`;
  const contrast = `var(--${color}-contrasttext)`;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "var(--font-family-base)",
    fontWeight: "var(--font-weight-medium)",
    fontSize: font,
    lineHeight: 1.75,
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    padding: pad,
    borderRadius: "var(--hr-radius)",
    cursor: disabled ? "default" : "pointer",
    border: "1px solid transparent",
    width: fullWidth ? "100%" : "auto",
    transition: "background-color .2s, box-shadow .2s, border-color .2s",
    userSelect: "none",
    whiteSpace: "nowrap"
  };
  const variants = {
    contained: {
      backgroundColor: disabled ? "var(--action-disabledbackground)" : main,
      color: disabled ? "var(--action-disabled)" : contrast,
      boxShadow: disabled ? "none" : "var(--hr-shadow-2)"
    },
    outlined: {
      backgroundColor: "transparent",
      color: disabled ? "var(--action-disabled)" : main,
      borderColor: disabled ? "var(--action-disabledbackground)" : `var(--${color}-states-outlinedborder)`
    },
    text: {
      backgroundColor: "transparent",
      color: disabled ? "var(--action-disabled)" : main
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    style: {
      ...base,
      ...variants[variant],
      ...style
    }
  }, rest), startIcon, children, endIcon);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
const {
  useState
} = React;
/** Checkbox — MUI control. Controlled via `checked` or self-managed. */
function Checkbox({
  checked,
  defaultChecked = false,
  label,
  color = "primary",
  size = "medium",
  disabled = false,
  indeterminate = false,
  onChange
}) {
  const [on, setOn] = useState(defaultChecked);
  const isOn = checked ?? on;
  const dim = size === "small" ? 18 : 24;
  const active = isOn || indeterminate;
  const tint = disabled ? "var(--action-disabled)" : active ? `var(--${color}-main)` : "var(--action-active)";
  const box = /*#__PURE__*/React.createElement("span", {
    onClick: () => {
      if (disabled) return;
      const n = !isOn;
      setOn(n);
      onChange && onChange(n);
    },
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: dim,
      height: dim,
      cursor: disabled ? "default" : "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: dim,
      color: tint
    }
  }, indeterminate ? "indeterminate_check_box" : isOn ? "check_box" : "check_box_outline_blank"));
  if (!label) return box;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      cursor: disabled ? "default" : "pointer",
      color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
      fontFamily: "var(--font-family-base)",
      fontSize: 16
    }
  }, box, label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * IconButton — square ripple-less icon button.
 * Pass a Material Symbols glyph name as `icon`, or arbitrary children.
 */
function IconButton({
  icon,
  children,
  color = "default",
  size = "medium",
  disabled = false,
  style,
  ...rest
}) {
  const dim = {
    small: 30,
    medium: 40,
    large: 48
  }[size];
  const glyph = {
    small: 18,
    medium: 24,
    large: 28
  }[size];
  const tint = color === "default" ? "var(--action-active)" : `var(--${color}-main)`;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: dim,
      height: dim,
      padding: 0,
      border: "none",
      borderRadius: "var(--hr-radius-pill)",
      backgroundColor: "transparent",
      color: disabled ? "var(--action-disabled)" : tint,
      cursor: disabled ? "default" : "pointer",
      transition: "background-color .2s",
      ...style
    },
    onMouseEnter: e => !disabled && (e.currentTarget.style.backgroundColor = "var(--action-hover)"),
    onMouseLeave: e => e.currentTarget.style.backgroundColor = "transparent"
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: glyph
    }
  }, icon) : children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
const {
  useState
} = React;
/** Radio — single MUI radio control. */
function Radio({
  checked,
  defaultChecked = false,
  label,
  value,
  name,
  color = "primary",
  size = "medium",
  disabled = false,
  onChange
}) {
  const [on, setOn] = useState(defaultChecked);
  const isOn = checked ?? on;
  const dim = size === "small" ? 18 : 24;
  const tint = disabled ? "var(--action-disabled)" : isOn ? `var(--${color}-main)` : "var(--action-active)";
  const dot = /*#__PURE__*/React.createElement("span", {
    onClick: () => {
      if (disabled) return;
      setOn(true);
      onChange && onChange(value);
    },
    className: "material-symbols-rounded",
    style: {
      fontSize: dim,
      color: tint,
      cursor: disabled ? "default" : "pointer"
    }
  }, isOn ? "radio_button_checked" : "radio_button_unchecked");
  if (!label) return dot;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      cursor: disabled ? "default" : "pointer",
      color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
      fontFamily: "var(--font-family-base)",
      fontSize: 16
    }
  }, dot, label);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
const {
  useState
} = React;
/** Select — outlined dropdown (presentational; opens a simple menu). */
function Select({
  label,
  value,
  options = [],
  size = "medium",
  disabled = false,
  fullWidth = false,
  style,
  onChange
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const h = size === "small" ? 40 : 56;
  const current = options.find(o => (o.value ?? o) === val);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      flexDirection: "column",
      gap: 4,
      width: fullWidth ? "100%" : 220,
      position: "relative",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-family-base)",
      fontSize: 12,
      fontWeight: 500,
      color: "var(--text-secondary)"
    }
  }, label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: disabled,
    onClick: () => setOpen(o => !o),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: h,
      padding: "0 12px 0 14px",
      borderRadius: "var(--hr-radius)",
      border: "1px solid var(--components-input-outlined-enabledborder)",
      background: "transparent",
      cursor: disabled ? "default" : "pointer",
      fontFamily: "var(--font-family-base)",
      fontSize: 16,
      color: "var(--text-primary)",
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", null, current ? current.label ?? current : ""), /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 24,
      color: "var(--action-active)"
    }
  }, "arrow_drop_down")), open && !disabled && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      zIndex: 10,
      marginTop: 4,
      background: "var(--background-paper-elevation-8)",
      borderRadius: "var(--hr-radius)",
      boxShadow: "var(--hr-shadow-8)",
      padding: "8px 0",
      maxHeight: 240,
      overflowY: "auto"
    }
  }, options.map(o => {
    const ov = o.value ?? o,
      ol = o.label ?? o;
    return /*#__PURE__*/React.createElement("div", {
      key: ov,
      onClick: () => {
        setVal(ov);
        setOpen(false);
        onChange && onChange(ov);
      },
      style: {
        padding: "8px 16px",
        fontFamily: "var(--font-family-base)",
        fontSize: 16,
        cursor: "pointer",
        color: "var(--text-primary)",
        backgroundColor: ov === val ? "var(--primary-states-selected)" : "transparent"
      },
      onMouseEnter: e => e.currentTarget.style.backgroundColor = "var(--action-hover)",
      onMouseLeave: e => e.currentTarget.style.backgroundColor = ov === val ? "var(--primary-states-selected)" : "transparent"
    }, ol);
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
const {
  useState
} = React;
/** Switch — MUI toggle. */
function Switch({
  checked,
  defaultChecked = false,
  label,
  color = "primary",
  size = "medium",
  disabled = false,
  onChange
}) {
  const [on, setOn] = useState(defaultChecked);
  const isOn = checked ?? on;
  const w = size === "small" ? 33 : 42;
  const h = size === "small" ? 14 : 16;
  const knob = size === "small" ? 12 : 20;
  const trackOn = `var(--${color}-main)`;
  const sw = /*#__PURE__*/React.createElement("span", {
    onClick: () => {
      if (disabled) return;
      const n = !isOn;
      setOn(n);
      onChange && onChange(n);
    },
    style: {
      position: "relative",
      display: "inline-block",
      width: w,
      height: h,
      borderRadius: 999,
      backgroundColor: disabled ? "var(--action-disabledbackground)" : isOn ? trackOn : "var(--components-switch-slideunchecked)",
      opacity: isOn && !disabled ? 0.5 : 0.38,
      cursor: disabled ? "default" : "pointer",
      transition: "background-color .2s"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: "50%",
      left: isOn ? `calc(100% - ${knob}px - -2px)` : -2,
      transform: `translateY(-50%) translateX(${isOn ? -2 : 2}px)`,
      width: knob,
      height: knob,
      borderRadius: "50%",
      backgroundColor: disabled ? "var(--grey-100)" : isOn ? trackOn : "var(--components-switch-knobfillenabled)",
      opacity: 1,
      boxShadow: "var(--hr-shadow-1)",
      transition: "left .2s, transform .2s, background-color .2s"
    }
  }));
  if (!label) return sw;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      cursor: disabled ? "default" : "pointer",
      color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
      fontFamily: "var(--font-family-base)",
      fontSize: 16
    }
  }, sw, label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * TextField — outlined / filled / standard text input with floating label.
 * Controlled or uncontrolled; supports helperText, error, sizes.
 */
function TextField({
  label,
  value,
  placeholder,
  helperText,
  variant = "outlined",
  size = "medium",
  error = false,
  disabled = false,
  startAdornment,
  endAdornment,
  fullWidth = false,
  style,
  ...rest
}) {
  const h = size === "small" ? 40 : 56;
  const borderColor = error ? "var(--error-main)" : "var(--components-input-outlined-enabledborder)";
  const labelColor = error ? "var(--error-main)" : "var(--text-secondary)";
  const field = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: h,
    padding: "0 14px",
    borderRadius: "var(--hr-radius)",
    border: variant === "outlined" ? `1px solid ${borderColor}` : "none",
    borderBottom: variant !== "outlined" ? `1px solid ${borderColor}` : undefined,
    borderRadius: variant === "filled" ? "var(--hr-radius) var(--hr-radius) 0 0" : "var(--hr-radius)",
    backgroundColor: variant === "filled" ? "var(--components-input-filled-enabledfill)" : "transparent",
    opacity: disabled ? 0.5 : 1
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      flexDirection: "column",
      gap: 4,
      width: fullWidth ? "100%" : 220,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-family-base)",
      fontSize: 12,
      fontWeight: 500,
      color: labelColor
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: field
  }, startAdornment && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--action-active)",
      display: "inline-flex"
    }
  }, startAdornment), /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    placeholder: placeholder,
    disabled: disabled,
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-family-base)",
      fontSize: 16,
      color: "var(--text-primary)"
    }
  }, rest)), endAdornment && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--action-active)",
      display: "inline-flex"
    }
  }, endAdornment)), helperText && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-family-base)",
      fontSize: 12,
      color: error ? "var(--error-main)" : "var(--text-secondary)",
      paddingLeft: 2
    }
  }, helperText));
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextField.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumbs.jsx
try { (() => {
/** Breadcrumbs — path trail. items: [{label, href}]. */
function Breadcrumbs({
  items = [],
  separator = "/",
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      fontFamily: "var(--font-family-base)",
      fontSize: 14,
      ...style
    }
  }, items.map((it, i) => {
    const last = i === items.length - 1;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: last ? "var(--text-primary)" : "var(--text-secondary)",
        cursor: last ? "default" : "pointer",
        textDecoration: last ? "none" : "underline",
        textDecorationColor: "var(--divider)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4
      }
    }, it.icon && /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: 18
      }
    }, it.icon), it.label ?? it), !last && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--action-disabled)"
      }
    }, separator));
  }));
}
Object.assign(__ds_scope, { Breadcrumbs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumbs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Pagination.jsx
try { (() => {
const {
  useState
} = React;
/** Pagination — page number control. */
function Pagination({
  count = 1,
  page,
  defaultPage = 1,
  onChange,
  color = "primary",
  shape = "circular",
  size = "medium",
  style
}) {
  const [pg, setPg] = useState(defaultPage);
  const cur = page ?? pg;
  const dim = {
    small: 26,
    medium: 32,
    large: 40
  }[size];
  const set = p => {
    if (p < 1 || p > count) return;
    setPg(p);
    onChange && onChange(p);
  };
  const pages = [];
  const push = p => pages.push(p);
  push(1);
  let start = Math.max(2, cur - 1),
    end = Math.min(count - 1, cur + 1);
  if (start > 2) push("…");
  for (let i = start; i <= end; i++) push(i);
  if (end < count - 1) push("……");
  if (count > 1) push(count);
  const cell = extra => ({
    minWidth: dim,
    height: dim,
    padding: "0 6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: shape === "rounded" ? "var(--hr-radius)" : "var(--hr-radius-pill)",
    fontFamily: "var(--font-family-base)",
    fontSize: 14,
    cursor: "pointer",
    border: "none",
    background: "transparent",
    color: "var(--text-primary)",
    ...extra
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => set(cur - 1),
    style: cell({
      cursor: cur === 1 ? "default" : "pointer",
      opacity: cur === 1 ? 0.4 : 1
    })
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 20
    }
  }, "chevron_left")), pages.map((p, i) => typeof p === "string" ? /*#__PURE__*/React.createElement("span", {
    key: i,
    style: cell({
      cursor: "default",
      color: "var(--text-secondary)"
    })
  }, "\u2026") : /*#__PURE__*/React.createElement("button", {
    key: i,
    type: "button",
    onClick: () => set(p),
    style: cell(p === cur ? {
      background: `var(--${color}-main)`,
      color: `var(--${color}-contrasttext)`
    } : {})
  }, p)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => set(cur + 1),
    style: cell({
      cursor: cur === count ? "default" : "pointer",
      opacity: cur === count ? 0.4 : 1
    })
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 20
    }
  }, "chevron_right")));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Stepper.jsx
try { (() => {
/** Stepper — horizontal progress through steps. steps: string[]. */
function Stepper({
  steps = [],
  activeStep = 0,
  color = "primary",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      width: "100%",
      fontFamily: "var(--font-family-base)",
      ...style
    }
  }, steps.map((label, i) => {
    const done = i < activeStep,
      active = i === activeStep;
    const filled = done || active;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 24,
        height: 24,
        borderRadius: "50%",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: filled ? `var(--${color}-main)` : "var(--action-disabled)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 500
      }
    }, done ? /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: 16
      }
    }, "check") : i + 1), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        color: filled ? "var(--text-primary)" : "var(--text-secondary)"
      }
    }, label)), i < steps.length - 1 && /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 1,
        backgroundColor: "var(--divider)",
        margin: "0 12px"
      }
    }));
  }));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
const {
  useState
} = React;
/** Tabs — horizontal tab bar. tabs: [{label, icon}]. */
function Tabs({
  tabs = [],
  value,
  defaultValue = 0,
  onChange,
  color = "primary",
  variant = "standard",
  style
}) {
  const [val, setVal] = useState(defaultValue);
  const active = value ?? val;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: "1px solid var(--divider)",
      display: "flex",
      ...style
    }
  }, tabs.map((t, i) => {
    const on = i === active;
    const label = t.label ?? t;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      onClick: () => {
        setVal(i);
        onChange && onChange(i);
      },
      style: {
        flex: variant === "fullWidth" ? 1 : "0 0 auto",
        display: "inline-flex",
        flexDirection: t.icon && t.iconPosition !== "start" ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 48,
        padding: "0 16px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "var(--font-family-base)",
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
        color: on ? `var(--${color}-main)` : "var(--text-secondary)",
        borderBottom: `2px solid ${on ? `var(--${color}-main)` : "transparent"}`,
        marginBottom: -1,
        transition: "color .2s, border-color .2s"
      }
    }, t.icon && /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: 20
      }
    }, t.icon), label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Accordion.jsx
try { (() => {
const {
  useState
} = React;
/** Accordion — expandable panel. */
function Accordion({
  summary,
  children,
  defaultExpanded = false,
  disabled = false,
  style
}) {
  const [open, setOpen] = useState(defaultExpanded);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: "var(--background-paper-elevation-1)",
      boxShadow: "var(--hr-shadow-1)",
      borderRadius: 0,
      fontFamily: "var(--font-family-base)",
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => !disabled && setOpen(o => !o),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      minHeight: 48,
      cursor: disabled ? "default" : "pointer",
      fontSize: 16,
      color: "var(--text-primary)"
    }
  }, /*#__PURE__*/React.createElement("span", null, summary), /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      transition: "transform .2s",
      transform: open ? "rotate(180deg)" : "none",
      color: "var(--action-active)"
    }
  }, "expand_more")), open && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 16px 16px",
      fontSize: 14,
      color: "var(--text-secondary)",
      lineHeight: 1.5,
      borderTop: "1px solid var(--divider)"
    }
  }, children));
}
Object.assign(__ds_scope, { Accordion });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Accordion.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Card — surface with optional header, media, content and actions. */
function Card({
  children,
  variant = "elevation",
  elevation = 1,
  style,
  ...rest
}) {
  const isOutlined = variant === "outlined";
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      backgroundColor: "var(--background-paper-elevation-1)",
      borderRadius: "var(--hr-radius)",
      overflow: "hidden",
      boxShadow: isOutlined ? "none" : `var(--hr-shadow-${elevation})`,
      border: isOutlined ? "1px solid var(--elevation-outlined)" : "none",
      color: "var(--text-primary)",
      fontFamily: "var(--font-family-base)",
      ...style
    }
  }, rest), children);
}
function CardHeader({
  avatar,
  title,
  subheader,
  action,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: 16,
      ...style
    }
  }, avatar, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      color: "var(--text-primary)"
    }
  }, title), subheader && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--text-secondary)"
    }
  }, subheader)), action);
}
function CardMedia({
  image,
  height = 160,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      backgroundImage: `url(${image})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      ...style
    }
  });
}
function CardContent({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      fontSize: 14,
      color: "var(--text-secondary)",
      lineHeight: 1.5,
      ...style
    }
  }, children);
}
function CardActions({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: 8,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardMedia, CardContent, CardActions });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Paper.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Paper — base elevated/outlined surface. */
function Paper({
  elevation = 1,
  variant = "elevation",
  square = false,
  children,
  style,
  ...rest
}) {
  const isOutlined = variant === "outlined";
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      backgroundColor: `var(--background-paper-elevation-${Math.min(elevation, 24)})`,
      borderRadius: square ? 0 : "var(--hr-radius)",
      boxShadow: isOutlined ? "none" : `var(--hr-shadow-${elevation})`,
      border: isOutlined ? "1px solid var(--elevation-outlined)" : "none",
      color: "var(--text-primary)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Paper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Paper.jsx", error: String((e && e.message) || e) }); }

// ui_kits/restaurant-manager/BrandMenusScreen.jsx
try { (() => {
// Brand Menus screen — menu category tabs + item grid (default landing view)
function RMBrandMenus() {
  const NS = window.HungerRushDesignSystem_019e09;
  const {
    Card,
    CardMedia,
    CardContent,
    Tabs,
    Chip,
    Button,
    IconButton,
    Switch,
    Breadcrumbs
  } = NS;
  const {
    useState
  } = React;
  const items = [{
    name: "Margherita Pizza",
    price: "$14.00",
    cat: "Pizza",
    img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=70",
    on: true
  }, {
    name: "Pepperoni Classic",
    price: "$16.50",
    cat: "Pizza",
    img: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&q=70",
    on: true
  }, {
    name: "Garlic Knots",
    price: "$6.00",
    cat: "Sides",
    img: "https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=500&q=70",
    on: true
  }, {
    name: "Caesar Salad",
    price: "$9.25",
    cat: "Salads",
    img: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=500&q=70",
    on: false
  }, {
    name: "Tiramisu",
    price: "$7.50",
    cat: "Desserts",
    img: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500&q=70",
    on: true
  }, {
    name: "Craft Lemonade",
    price: "$3.75",
    cat: "Drinks",
    img: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=500&q=70",
    on: true
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32,
      fontFamily: "var(--font-family-base)"
    }
  }, /*#__PURE__*/React.createElement(Breadcrumbs, {
    items: [{
      label: "Manage",
      icon: "home"
    }, {
      label: "Brand Menus"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      margin: "12px 0 20px"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "hr-h4",
    style: {
      margin: 0
    }
  }, "Brand Menus"), /*#__PURE__*/React.createElement(Button, {
    startIcon: /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: 18
      }
    }, "add")
  }, "New item")), /*#__PURE__*/React.createElement(Tabs, {
    tabs: ["All", "Pizza", "Sides", "Salads", "Desserts", "Drinks"],
    defaultValue: 0
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 20,
      marginTop: 24
    }
  }, items.map(it => /*#__PURE__*/React.createElement(Card, {
    key: it.name
  }, /*#__PURE__*/React.createElement(CardMedia, {
    image: it.img,
    height: 150
  }), /*#__PURE__*/React.createElement(CardContent, {
    style: {
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "hr-subtitle1",
    style: {
      fontWeight: 500,
      color: "var(--text-primary)",
      lineHeight: 1.3
    }
  }, it.name), /*#__PURE__*/React.createElement(Chip, {
    size: "small",
    label: it.cat,
    variant: "outlined"
  })), /*#__PURE__*/React.createElement("div", {
    className: "hr-h6",
    style: {
      color: "var(--primary-main)"
    }
  }, it.price)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    defaultChecked: it.on,
    label: it.on ? "Available" : "86'd"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "edit",
    size: "small"
  })))))));
}
window.RMBrandMenus = RMBrandMenus;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/restaurant-manager/BrandMenusScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/restaurant-manager/DashboardScreen.jsx
try { (() => {
// Dashboard screen — stat cards, sales summary, recent orders
function RMDashboard() {
  const NS = window.HungerRushDesignSystem_019e09;
  const {
    Card,
    CardContent,
    Chip,
    LinearProgress,
    Avatar,
    Divider
  } = NS;
  const stats = [{
    label: "Orders today",
    value: "184",
    delta: "+12%",
    up: true,
    icon: "receipt_long",
    color: "var(--primary-main)"
  }, {
    label: "Net sales",
    value: "$4,210",
    delta: "+8.4%",
    up: true,
    icon: "payments",
    color: "var(--sea-blue-500)"
  }, {
    label: "Avg ticket",
    value: "$22.88",
    delta: "-1.2%",
    up: false,
    icon: "sell",
    color: "var(--warning-main)"
  }, {
    label: "Avg prep time",
    value: "13m",
    delta: "+2m",
    up: false,
    icon: "timer",
    color: "var(--info-main)"
  }];
  const channels = [{
    label: "Online ordering",
    pct: 46,
    color: "primary"
  }, {
    label: "Phone",
    pct: 28,
    color: "secondary"
  }, {
    label: "Walk-in",
    pct: 18,
    color: "info"
  }, {
    label: "Third-party",
    pct: 8,
    color: "warning"
  }];
  const orders = [{
    id: "#10482",
    name: "Maria Lopez",
    items: "2 items",
    total: "$31.40",
    status: "In kitchen",
    sev: "warning"
  }, {
    id: "#10481",
    name: "James Carter",
    items: "5 items",
    total: "$58.10",
    status: "Out for delivery",
    sev: "info"
  }, {
    id: "#10480",
    name: "Aisha Khan",
    items: "1 item",
    total: "$14.25",
    status: "Completed",
    sev: "success"
  }, {
    id: "#10479",
    name: "Tom Becker",
    items: "3 items",
    total: "$42.00",
    status: "Completed",
    sev: "success"
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32,
      fontFamily: "var(--font-family-base)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "hr-h4",
    style: {
      marginBottom: 4
    }
  }, "Dashboard"), /*#__PURE__*/React.createElement("p", {
    className: "hr-body2",
    style: {
      color: "var(--text-secondary)",
      marginBottom: 24
    }
  }, "Westgate Pizza \xB7 Friday, June 13"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 20,
      marginBottom: 24
    }
  }, stats.map(s => /*#__PURE__*/React.createElement(Card, {
    key: s.label
  }, /*#__PURE__*/React.createElement(CardContent, {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 30,
      color: s.color
    }
  }, s.icon), /*#__PURE__*/React.createElement(Chip, {
    size: "small",
    label: s.delta,
    color: s.up ? "success" : "error",
    variant: "outlined"
  })), /*#__PURE__*/React.createElement("div", {
    className: "hr-h4",
    style: {
      marginTop: 12,
      color: "var(--text-primary)"
    }
  }, s.value), /*#__PURE__*/React.createElement("div", {
    className: "hr-body2",
    style: {
      color: "var(--text-secondary)"
    }
  }, s.label))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1.4fr",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardContent, {
    style: {
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hr-h6",
    style: {
      marginBottom: 20
    }
  }, "Sales by channel"), channels.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.label,
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 14,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-primary)"
    }
  }, c.label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-secondary)"
    }
  }, c.pct, "%")), /*#__PURE__*/React.createElement(LinearProgress, {
    value: c.pct,
    color: c.color
  }))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardContent, {
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hr-h6",
    style: {
      padding: "20px 24px 12px"
    }
  }, "Recent orders"), orders.map((o, i) => /*#__PURE__*/React.createElement("div", {
    key: o.id
  }, i > 0 && /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "12px 24px"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: 38,
    color: "var(--grey-400)"
  }, o.name.split(" ").map(n => n[0]).join("")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 500,
      color: "var(--text-primary)"
    }
  }, o.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--text-secondary)"
    }
  }, o.id, " \xB7 ", o.items)), /*#__PURE__*/React.createElement(Chip, {
    size: "small",
    label: o.status,
    color: o.sev
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      textAlign: "right",
      fontWeight: 500,
      color: "var(--text-primary)"
    }
  }, o.total))))))));
}
window.RMDashboard = RMDashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/restaurant-manager/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/restaurant-manager/Sidebar.jsx
try { (() => {
// HungerRush Restaurant Manager — primary navigation sidebar (dark navy, 280px)
const {
  useState
} = React;
const RM_NAV = [{
  label: "Dashboard",
  icon: "dashboard"
}, {
  label: "Reporting",
  icon: "monitoring"
}, {
  label: "Manage",
  icon: "build",
  children: ["Coupon", "Dynamic Codes", "Images - 3rd Party", "Menu", "Brand Menus", "Store Menus", "Menu Schedules", "Roles", "Stores & Groups", "System", "Users"]
}, {
  label: "People",
  icon: "groups"
}, {
  label: "Communicate",
  icon: "chat"
}, {
  label: "Inventory",
  icon: "warehouse"
}, {
  label: "Loyalty",
  icon: "loyalty"
}, {
  label: "Marketing",
  icon: "campaign"
}, {
  label: "Display",
  icon: "desktop_windows"
}, {
  label: "HungerRush Only",
  icon: "lock_open"
}];
function RMSidebar({
  active = "Brand Menus",
  openSection = "Manage",
  onNavigate
}) {
  const [open, setOpen] = useState(openSection);
  const itemBase = {
    display: "flex",
    alignItems: "center",
    gap: 20,
    width: "100%",
    height: 60,
    padding: "0 24px",
    boxSizing: "border-box",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "var(--hr-nav-text)",
    fontFamily: "var(--font-family-base)",
    fontSize: 20,
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden"
  };
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      width: "var(--hr-nav-width)",
      minWidth: "var(--hr-nav-width)",
      alignSelf: "stretch",
      backgroundColor: "var(--hr-nav-bg)",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "24px 20px 8px"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/hungerrush-icon.png",
    alt: "",
    style: {
      width: 32,
      height: 32
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-family-brand)",
      fontWeight: 700,
      fontSize: 23,
      color: "#fff"
    }
  }, "HungerRush")), /*#__PURE__*/React.createElement("button", {
    style: {
      ...itemBase,
      height: 44,
      justifyContent: "flex-start",
      color: "var(--hr-nav-text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 24
    }
  }, "chevron_left")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, RM_NAV.map(it => {
    const sectionOpen = open === it.label;
    const isActiveTop = !it.children && active === it.label;
    return /*#__PURE__*/React.createElement("div", {
      key: it.label,
      style: {
        backgroundColor: sectionOpen ? "var(--hr-nav-section-active)" : "transparent"
      }
    }, /*#__PURE__*/React.createElement("button", {
      style: {
        ...itemBase,
        backgroundColor: isActiveTop ? "var(--hr-nav-section-active)" : "transparent",
        fontWeight: isActiveTop ? 700 : 400
      },
      onClick: () => {
        it.children ? setOpen(sectionOpen ? "" : it.label) : onNavigate && onNavigate(it.label);
      },
      onMouseEnter: e => {
        if (!isActiveTop && !sectionOpen) e.currentTarget.style.backgroundColor = "var(--hr-nav-item-hover)";
      },
      onMouseLeave: e => {
        if (!isActiveTop && !sectionOpen) e.currentTarget.style.backgroundColor = "transparent";
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: 24,
        flexShrink: 0
      }
    }, it.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, it.label)), it.children && sectionOpen && it.children.map(c => {
      const on = active === c;
      return /*#__PURE__*/React.createElement("button", {
        key: c,
        style: {
          ...itemBase,
          height: 46,
          paddingLeft: 24,
          fontSize: 18,
          color: on ? "#fff" : "var(--hr-nav-text-muted)",
          fontWeight: on ? 700 : 400
        },
        onClick: () => onNavigate && onNavigate(c),
        onMouseEnter: e => {
          if (!on) e.currentTarget.style.color = "#fff";
        },
        onMouseLeave: e => {
          if (!on) e.currentTarget.style.color = "var(--hr-nav-text-muted)";
        }
      }, c);
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 24px",
      color: "rgba(255,255,255,0.6)",
      fontSize: 13,
      fontFamily: "var(--font-family-base)",
      lineHeight: 1.5
    }
  }, "Powered by HungerRush LLC.", /*#__PURE__*/React.createElement("br", null), "v24.08.12.1650"));
}
window.RMSidebar = RMSidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/restaurant-manager/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/restaurant-manager/TopBar.jsx
try { (() => {
// HungerRush Restaurant Manager — top app bar (teal / primary) + store selector
function RMTopBar({
  title = "Brand Menus",
  store = "Westgate Pizza",
  onMenu
}) {
  const {
    IconButton,
    Badge,
    Avatar
  } = window.HungerRushDesignSystem_019e09;
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: 64,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 16px",
      backgroundColor: "var(--primary-main)",
      color: "#fff",
      fontFamily: "var(--font-family-base)",
      boxShadow: "var(--hr-shadow-4)",
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onMenu,
    style: {
      border: "none",
      background: "transparent",
      color: "#fff",
      cursor: "pointer",
      display: "inline-flex",
      padding: 8,
      borderRadius: 999
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 26
    }
  }, "menu")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 500,
      marginLeft: 4
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 38,
      padding: "0 14px",
      borderRadius: "var(--hr-radius)",
      border: "1px solid rgba(255,255,255,0.5)",
      background: "rgba(255,255,255,0.08)",
      color: "#fff",
      cursor: "pointer",
      fontFamily: "var(--font-family-base)",
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 20
    }
  }, "storefront"), store, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 20
    }
  }, "expand_more")), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#fff",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    badgeContent: 3,
    color: "error"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      padding: 8,
      borderRadius: 999,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: 24,
      color: "#fff"
    }
  }, "notifications")))), /*#__PURE__*/React.createElement(Avatar, {
    size: 36,
    color: "var(--sea-blue-700)"
  }, "OP"));
}
window.RMTopBar = RMTopBar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/restaurant-manager/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/restaurant-manager/UsersScreen.jsx
try { (() => {
// Users screen — management data table (search, filters, table, pagination)
function RMUsers() {
  const NS = window.HungerRushDesignSystem_019e09;
  const {
    Card,
    TextField,
    Select,
    IconButton,
    Button,
    Checkbox,
    Avatar,
    Chip,
    Pagination
  } = NS;
  const {
    useState
  } = React;
  const users = [{
    name: "Xin Yue",
    email: "xin.yue@store.com",
    role: "Manager",
    roleColor: "primary",
    stores: "3 stores",
    status: "Active",
    last: "2 min ago"
  }, {
    name: "Marcus Bell",
    email: "marcus.b@store.com",
    role: "Cashier",
    roleColor: "secondary",
    stores: "Westgate",
    status: "Active",
    last: "1 hr ago"
  }, {
    name: "Priya Nair",
    email: "priya.n@store.com",
    role: "Owner",
    roleColor: "warning",
    stores: "All stores",
    status: "Active",
    last: "Today"
  }, {
    name: "Diego Ramos",
    email: "diego.r@store.com",
    role: "Driver",
    roleColor: "info",
    stores: "Downtown",
    status: "Invited",
    last: "—"
  }, {
    name: "Hannah Cole",
    email: "hannah.c@store.com",
    role: "Cashier",
    roleColor: "secondary",
    stores: "North Loop",
    status: "Disabled",
    last: "3 days ago"
  }];
  const [sel, setSel] = useState({});
  const allOn = users.every((_, i) => sel[i]);
  const th = {
    padding: "14px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: ".4px",
    whiteSpace: "nowrap"
  };
  const td = {
    padding: "10px 16px",
    fontSize: 14,
    color: "var(--text-primary)",
    borderTop: "1px solid var(--divider)"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32,
      fontFamily: "var(--font-family-base)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "hr-h4",
    style: {
      marginBottom: 24
    }
  }, "User management"), /*#__PURE__*/React.createElement(Card, {
    variant: "outlined"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: 16,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Search",
    placeholder: "Name, email, etc\u2026",
    startAdornment: /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: 20
      }
    }, "search"),
    style: {
      width: 280
    }
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Attribute",
    value: "role",
    options: [{
      value: "role",
      label: "Role"
    }, {
      value: "store",
      label: "Store"
    }, {
      value: "status",
      label: "Status"
    }],
    style: {
      width: 160
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "filter_list"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outlined",
    color: "inherit",
    startIcon: /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: 18
      }
    }, "download")
  }, "Export"), /*#__PURE__*/React.createElement(Button, {
    startIcon: /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-rounded",
      style: {
        fontSize: 18
      }
    }, "add")
  }, "Add user")), /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderTop: "1px solid var(--divider)",
      background: "var(--grey-50)"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      ...th,
      width: 48
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: allOn,
    onChange: v => setSel(v ? users.reduce((a, _, i) => (a[i] = true, a), {}) : {})
  })), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Name"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Role"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Stores"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Last active"), /*#__PURE__*/React.createElement("th", {
    style: {
      ...th,
      width: 56
    }
  }))), /*#__PURE__*/React.createElement("tbody", null, users.map((u, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    style: {
      background: sel[i] ? "var(--primary-states-selected)" : "transparent"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: !!sel[i],
    onChange: v => setSel(s => ({
      ...s,
      [i]: v
    }))
  })), /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: 36,
    color: "var(--grey-400)"
  }, u.name.split(" ").map(n => n[0]).join("")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 500
    }
  }, u.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--text-secondary)"
    }
  }, u.email)))), /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement(Chip, {
    size: "small",
    label: u.role,
    color: u.roleColor,
    variant: "outlined"
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      ...td,
      color: "var(--text-secondary)"
    }
  }, u.stores), /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement(Chip, {
    size: "small",
    label: u.status,
    color: u.status === "Active" ? "success" : u.status === "Invited" ? "info" : "default",
    icon: u.status === "Active" ? "circle" : undefined
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      ...td,
      color: "var(--text-secondary)"
    }
  }, u.last), /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "more_vert",
    size: "small"
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 24,
      padding: "12px 16px",
      borderTop: "1px solid var(--divider)",
      fontSize: 14,
      color: "var(--text-secondary)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "1\u20135 of 13"), /*#__PURE__*/React.createElement(Pagination, {
    count: 3,
    defaultPage: 1
  }))));
}
window.RMUsers = RMUsers;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/restaurant-manager/UsersScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.AvatarGroup = __ds_scope.AvatarGroup;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Divider = __ds_scope.Divider;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Typography = __ds_scope.Typography;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.CircularProgress = __ds_scope.CircularProgress;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.LinearProgress = __ds_scope.LinearProgress;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.Breadcrumbs = __ds_scope.Breadcrumbs;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Accordion = __ds_scope.Accordion;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardMedia = __ds_scope.CardMedia;

__ds_ns.CardContent = __ds_scope.CardContent;

__ds_ns.CardActions = __ds_scope.CardActions;

__ds_ns.Paper = __ds_scope.Paper;

})();
