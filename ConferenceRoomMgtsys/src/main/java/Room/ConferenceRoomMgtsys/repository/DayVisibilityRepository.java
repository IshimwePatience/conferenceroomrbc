package Room.ConferenceRoomMgtsys.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import Room.ConferenceRoomMgtsys.model.DayVisibility;
import Room.ConferenceRoomMgtsys.model.Organization;
import Room.ConferenceRoomMgtsys.model.Room;

@Repository
public interface DayVisibilityRepository extends JpaRepository<DayVisibility, java.util.UUID> {

    List<DayVisibility> findByDate(LocalDate date);

    List<DayVisibility> findByRoomAndDate(Room room, LocalDate date);

    @Query("SELECT dv FROM DayVisibility dv WHERE dv.room.organization = :org AND dv.date = :date AND dv.visible = true")
    List<DayVisibility> findVisibleByOrganizationAndDate(@Param("org") Organization org, @Param("date") LocalDate date);
}


