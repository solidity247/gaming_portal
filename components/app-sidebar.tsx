"use client";

import * as React from "react";
import {
  IconHelp,
  IconHistory,
  IconInnerShadowTop,
  IconUser,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { NavUserClerk } from "./nav-user-clerk";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Tournaments",
      url: "/portal/tournaments",
      icon: IconUsers,
    },
    {
      title: "Game history",
      url: "/portal/game-history",
      icon: IconHistory,
    },
    {
      title: "Friends",
      url: "/portal/friends",
      icon: IconUsersGroup,
    },
    {
      title: "Account",
      url: "/portal/account",
      icon: IconUser,
    },
  ],

  navSecondary: [
    {
      title: "Get Help",
      url: "/help",
      icon: IconHelp,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/portal">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">LiGammon</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUserClerk />
        <div className="h-10"></div>
      </SidebarFooter>
    </Sidebar>
  );
}
