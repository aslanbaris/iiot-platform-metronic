import { Fragment, useEffect, useState } from 'react';
import { PageMenu } from '@/pages/public-profile';
import { UserHero } from '@/partials/common/user-hero';
import { DropdownMenu9 } from '@/partials/dropdown-menu/dropdown-menu-9';
import { Navbar, NavbarActions } from '@/partials/navbar/navbar';
import {
  EllipsisVertical,
  MapPin,
  MessagesSquare,
  ScanEye,
  SquarePlus,
  Twitch,
  Users,
} from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { ProfileGamerContent } from '.';
import { useAuth } from '@/auth/context/auth-context';
import { UserModel } from '@/auth/lib/models';

export function ProfileGamerPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  const displayName = user?.displayName || user?.firstName || user?.email || 'User';
  const userImage = user?.avatar ? (
    <img
      src={user.avatar}
      className="rounded-full border-3 border-green-500 size-[100px] shrink-0 object-cover"
      alt="User Avatar"
    />
  ) : (
    <img
      src={toAbsoluteUrl('/media/avatars/300-27.png')}
      className="rounded-full border-3 border-green-500 size-[100px] shrink-0"
      alt="image"
    />
  );

  const userInfo = [
    ...(user?.location ? [{ label: user.location, icon: MapPin }] : []),
    ...(user?.username ? [{ label: user.username, icon: Twitch }] : []),
    { email: 'Level 22', icon: ScanEye }, // Gaming level - could be dynamic later
  ];

  return (
    <Fragment>
      <UserHero
        name={displayName}
        image={userImage}
        info={userInfo}
      />
      <Container>
        <Navbar>
          <PageMenu />
          <NavbarActions>
            <Button>
              <Users /> Connect
            </Button>
            <Button variant="outline">
              <SquarePlus /> Invite to Team
            </Button>
            <Button variant="outline" mode="icon">
              <MessagesSquare />
            </Button>
            <DropdownMenu9
              trigger={
                <Button variant="outline" mode="icon">
                  <EllipsisVertical />
                </Button>
              }
            />
          </NavbarActions>
        </Navbar>
      </Container>
      <Container>
        <ProfileGamerContent />
      </Container>
    </Fragment>
  );
}
