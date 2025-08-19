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
  SquareMousePointer,
  Users,
  Volleyball,
} from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { ProfileCreatorContent } from '.';
import { useAuth } from '@/auth/context/auth-context';
import { UserModel } from '@/auth/lib/models';

export function ProfileCreatorPage() {
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
      className="size-[100px] rounded-full object-cover"
      alt="User Avatar"
    />
  ) : (
    <div className="flex items-center justify-center rounded-full border-2 border-red-200 bg-background size-[100px] shrink-0">
      <img
        src={toAbsoluteUrl('/media/brand-logos/inferno.svg')}
        className="size-11"
        alt="image"
      />
    </div>
  );

  const userInfo = [
    ...(user?.website ? [{ label: user.website, icon: Volleyball }] : []),
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
              <SquareMousePointer /> Hire Us
            </Button>
            <Button variant="outline">
              <Users /> Follow
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
        <ProfileCreatorContent />
      </Container>
    </Fragment>
  );
}
