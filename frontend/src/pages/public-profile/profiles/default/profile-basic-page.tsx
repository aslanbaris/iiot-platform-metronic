import { Fragment, useEffect, useState } from 'react';
import { PageMenu } from '@/pages/public-profile';
import { UserHero } from '@/partials/common/user-hero';
import { DropdownMenu9 } from '@/partials/dropdown-menu/dropdown-menu-9';
import { Navbar, NavbarActions } from '@/partials/navbar/navbar';
import {
  EllipsisVertical,
  Luggage,
  Mail,
  MapPin,
  MessageSquareText,
  Users,
} from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { ProfileDefaultContent } from '.';
import { useAuth } from '@/auth/context/auth-context';
import { UserModel } from '@/auth/lib/models';

export function ProfileDefaultPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [user]);

  if (loading) {
    return (
      <Fragment>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </Fragment>
    );
  }

  const displayName = user 
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Anonymous User'
    : 'Anonymous User';

  const image = (
    <img
      src={user?.avatar_url || toAbsoluteUrl('/media/avatars/300-1.png')}
      className="rounded-full border-3 border-green-500 size-[100px] shrink-0"
      alt="profile"
    />
  );

  const userInfo = [
    { label: 'IIOT Platform', icon: Luggage },
    { label: 'Remote', icon: MapPin },
    { email: user?.email || '', icon: Mail },
  ];

  return (
    <Fragment>
      <UserHero
        name={displayName}
        image={image}
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
              <MessageSquareText />
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
        <ProfileDefaultContent />
      </Container>
    </Fragment>
  );
}
