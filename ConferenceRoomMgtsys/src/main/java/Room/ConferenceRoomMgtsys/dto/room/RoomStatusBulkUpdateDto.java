package Room.ConferenceRoomMgtsys.dto.room;

import java.util.List;
import java.util.UUID;

public class RoomStatusBulkUpdateDto {
    private List<UUID> roomIds;
    private Boolean isActive;

    public List<UUID> getRoomIds() {
        return roomIds;
    }

    public void setRoomIds(List<UUID> roomIds) {
        this.roomIds = roomIds;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }
}


