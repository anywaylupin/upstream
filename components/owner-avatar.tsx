/** GitHub serves an owner's avatar at /{owner}.png, so no API call is needed. */
export function OwnerAvatar({
  owner,
  size = 20,
}: {
  owner: string;
  size?: number;
}) {
  return (
    // biome-ignore lint/performance/noImgElement: remote avatar, no next/image domain config wanted
    <img
      src={`https://github.com/${owner}.png?size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full ring-1 ring-foreground/10"
    />
  );
}
