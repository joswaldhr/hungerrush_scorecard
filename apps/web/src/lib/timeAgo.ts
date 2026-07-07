import { formatDistanceToNow, parseISO } from 'date-fns';

/** The one relative-time formatter — "about 2 hours ago", "6 days ago". */
export function timeAgo(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
}
