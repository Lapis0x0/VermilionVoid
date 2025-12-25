export type ProfileLinkType = "qq" | "music" | "github"

export const profile: {
  name: string
  bio: string
  avatar: string
  links: { type: ProfileLinkType; name: string; url: string }[]
} = {
  name: "时歌",
  bio: "理解以真实为本，但真实本身并不会自动呈现.",
  avatar: "/avatar.webp",
  links: [
    {
      type: "qq",
      name: "QQ",
      url: "https://qm.qq.com/q/Qm6VfZnWM0",
    },
    {
      type: "music",
      name: "NetEaseMusic",
      url: "https://music.163.com/#/user/home?id=1997803975",
    },
    {
      type: "github",
      name: "GitHub",
      url: "https://github.com/Lapis0x0",
    },
  ],
}
