import { Fragment, useEffect, useState } from 'react';
import { PageMenu } from '@/pages/public-profile';
import { UserHero } from '@/partials/common/user-hero';
import { DropdownMenu9 } from '@/partials/dropdown-menu/dropdown-menu-9';
import { Navbar, NavbarActions } from '@/partials/navbar/navbar';
import {
  EllipsisVertical,
  Mail,
  MapPin,
  MessagesSquare,
  Users,
  Zap,
} from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { ProfileActivityContent } from '.';
import { useAuth } from '@/auth/context/auth-context';
import { UserModel } from '@/auth/lib/models';

export function ProfileActivityPage() {
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
      src={toAbsoluteUrl('/media/avatars/300-1.png')}
      className="rounded-full border-3 border-green-500 size-[100px] shrink-0"
      alt="image"
    />
  );

  const userInfo = [
    ...(user?.company ? [{ label: user.company, icon: Zap }] : []),
    ...(user?.location ? [{ label: user.location, icon: MapPin }] : []),
    ...(user?.email ? [{ email: user.email, icon: Mail }] : []),
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
            <Button variant="outline" mode="icon">
              <MessagesSquare size={16} />
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
        <div className="flex flex-wrap items-center gap-5 justify-between mb-7.5">
          <h3 className="text-lg text-mono font-semibold">Activity</h3>
        </div>
        <ProfileActivityContent />
      </Container>
    </Fragment>
  );
}
