import { StatusBar } from 'expo-status-bar';
import React, { useState , useRef , useEffect } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  FlatList,
  Image,
  Platform,
  Alert,
  PermissionsAndroid,
} from "react-native";
import XLSX from 'xlsx';
import DeviceModal from "./DeviceConnectionModal";
import useBLE from "./useBLE";
import RNFS from 'react-native-fs';
import { MaterialIcons } from '@expo/vector-icons';  // Import MaterialIcons from expo
import SplashScreen from './SplashScreen'; // Add this import


interface MeasuredValue {
  id: number;
  partNumber: string;
  value: string;
}


const PAGE_SIZE = 12; // Number of items per page

export default function App() {
  const {
    requestPermissions,
    scanForPeripherals,
    allDevices,
    connectToDevice,
    connectedDevice,
    caliperValue,
    disconnectFromDevice,
  } = useBLE();

  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [caliperValueInput, setcaliperValueInput] = useState("");
  const [bleValue, setBleValue] = useState("");
  const [measuredValues, setMeasuredValues] = useState<MeasuredValue[]>([]);
  const [partNumberInput, setPartNumberInput] = useState<string>(''); // Add state for Part Number
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isStarted, setIsStarted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  console.log("caliperValue :", caliperValue);
  console.log("bleValue :" , bleValue);

  useEffect(()=>{
    setBleValue(String(caliperValue));
    setcaliperValueInput(bleValue);
  },[caliperValue , bleValue]);

  useEffect(() => {
    if (isStarted && caliperValueInput) {
      intervalRef.current = setInterval(() => {
        addMeasuredValue(caliperValueInput?.toString() || "");
        setcaliperValueInput("");
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isStarted, caliperValueInput , bleValue]);

  const scanForDevices = async () => {
    const isPermissionsEnabled = await requestPermissions();
    if (isPermissionsEnabled) {
      scanForPeripherals();
    }
  };

  const hideModal = () => {
    setIsModalVisible(false);
  };

  const openModal = async () => {
    scanForDevices();
    setIsModalVisible(true);
  };

  const addMeasuredValue = (value: string) => {
    if (value && partNumberInput) {
      const newValue: MeasuredValue = {
        id: measuredValues.length + 1, // Use timestamp as a unique identifier
        partNumber: partNumberInput, 
        value: value,
      };
      setMeasuredValues((prevValues) => [...prevValues, newValue]);
      setBleValue("");
      setcaliperValueInput("");
    }
   
  };

  const handleStart = () => {
    if (caliperValueInput && partNumberInput && !isStarted) {
      addMeasuredValue(caliperValueInput);
      setIsStarted(true);
      setBleValue("");
      setcaliperValueInput("");
    }
    else{
      Alert.alert(
        "Error",
        'Enter PartNumber and Value to Start'
      );
    }
  };

  const getNextAvailableFilename = async (baseFilename: string, extension: string): Promise<string> => {
    let counter = 1;
    let filename = `${baseFilename}.${extension}`;
    let filepath = `${RNFS.DownloadDirectoryPath}/${filename}`;
  
    // Check if file exists
    while (await RNFS.exists(filepath)) {
      counter++;
      filename = `${baseFilename}(${counter}).${extension}`;
      filepath = `${RNFS.DownloadDirectoryPath}/${filename}`;
    }
  
    return filename;
  };


  const exportToExcel = async () => {
    try {
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(measuredValues.map(item => ({
        'Sl. No.': item.id,
        'Part Number': item.partNumber,
        'Measured Value': item.value,
      })));
  
      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, "Measured Values");
  
      // Generate Excel file
      const wbout = XLSX.write(wb, { type: 'binary', bookType: "xlsx" });
  
      // Get unique filename
      const baseFilename = "measured_values";
      const filename = await getNextAvailableFilename(baseFilename, "xlsx");
      const filePath = `${RNFS.DownloadDirectoryPath}/${filename}`;
  
      // Write file
      await RNFS.writeFile(filePath, wbout, 'ascii');
  
      Alert.alert(
        "Export Successful", 
        `File saved as ${filename} in your Downloads folder.`
      );
  
    } catch (error) {
      console.error('Error exporting file:', error);
      Alert.alert("Export Failed", "There was an error exporting the file.");
    }
  };

  const handleDelete = (id: number) => {
    setMeasuredValues(prevValues => prevValues.filter(value => value.id !== id));
    // Adjust current page if necessary after deletion
    const newTotalPages = Math.ceil((measuredValues.length - 1) / PAGE_SIZE);
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages || 1);
    }
  };

  // Calculate the total number of pages
  const totalPages = Math.ceil(measuredValues.length / PAGE_SIZE);

  // Function to handle page change
  const changePage = (direction: 'next' | 'prev') => {
    if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    } else if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Get current page data
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const currentData = measuredValues.slice(startIndex, startIndex + PAGE_SIZE);


  const renderMainContent = ()=> (
<SafeAreaView style={styles.container}>
      {/* Top section with logo */}
      <View style={styles.topBar}>
        {/* Logo */}
        <Image source={require('./assets/logo.png')} style={styles.logo} />
      </View>

       {/* Part Number Input */}
       <View style={styles.partNumberInputRow}>
        <Text style={{ fontSize: 18 }}>Enter PartNumber : </Text>
        <TextInput
          style={styles.partNumberInput}
          placeholder="Enter PartNumber"
          value={partNumberInput}
          onChangeText={(text) => setPartNumberInput(text)}
        />
      </View>

      {/* Main UI for connecting, input, and adding measured values */}
      <View style={styles.inputRow}>
      <TouchableOpacity
        onPress={connectedDevice ? disconnectFromDevice : openModal}
        style={styles.connectButton}
      >
        <Text style={styles.connectButtonText}>
          {connectedDevice ? "Disconnect" : "Connect"}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={styles.caliperValueInput}
        keyboardType="numeric"
        placeholder="Enter Measured Value"
        value={caliperValueInput}
        onChangeText={(text) => setcaliperValueInput(text)}
      />

        <TouchableOpacity
          onPress={handleStart}
          style={[styles.addButton, isStarted && styles.disabledButton2]}
          disabled={isStarted}
        >
        <Text style={styles.addButtonText}>Start</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={exportToExcel}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>Export</Text>
      </TouchableOpacity> 

    </View>

      {/* Table for displaying measured values */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={styles.headerCell}>Sl.No.</Text>
          <Text style={styles.headerCell}>Part Number</Text>
          <Text style={styles.headerCell}>Measured Value</Text>
          <Text style={styles.headerCell}>Action</Text>
        </View>
        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item , index }) => (
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>{item.id}</Text>
              <Text style={styles.tableCell}>{item.partNumber}</Text>
              <Text style={styles.tableCell}>{item.value}</Text>
              <View style={styles.tableCell}>
                {item.id === measuredValues[measuredValues.length - 1].id && (
                  <TouchableOpacity 
                    onPress={() => handleDelete(item.id)}
                    style={styles.deleteButton}
                  >
                    <MaterialIcons name="delete" size={24} color="red" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      </View>

      <View style={styles.pagination}>
        <TouchableOpacity onPress={() => changePage('prev')} disabled={currentPage === 1}>
          <Text style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}>Previous</Text>
        </TouchableOpacity>
        <Text style={styles.paginationText}>Page {currentPage} of {totalPages}</Text>
        <TouchableOpacity onPress={() => changePage('next')} disabled={currentPage === totalPages}>
          <Text style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}>Next</Text>
        </TouchableOpacity>
      </View>

      {/* Device Modal */}
      <DeviceModal
        closeModal={hideModal}
        visible={isModalVisible}
        connectToPeripheral={connectToDevice}
        devices={allDevices}
      />
    </SafeAreaView>

  );


  return showSplash ? (
    <SplashScreen onComplete={() => setShowSplash(false)} />
  ) : (
    renderMainContent()
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20, 
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  caliperValueWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  caliperValueTitleText: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "black",
  },
  connectButton: {
    backgroundColor: "#007BFF",
    padding: 10,
    borderRadius: 5,
    width: '30%', // adjust the width for each element
    alignItems: 'center',
    marginRight: 5, // spacing between button and text input
  },
  connectButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center', // vertically center the items
    justifyContent: 'space-between', // add space between elements
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  caliperValueInput: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    paddingHorizontal: 10,
    borderRadius: 5,
    flex: 1, // let the input take remaining space
    marginHorizontal: 5, // spacing between text input and add button
  },
  addButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginLeft: 5, // spacing between input and add button
  },
  addButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    margin: 10,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 10,
  },
  headerCell: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableCell: {
    fontSize: 16,
    flex: 1,
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  paginationButton: {
    color: '#007BFF',
    fontWeight: 'bold',
  },
  disabledButton: {
    color: 'gray',
  },
  paginationText: {
    fontSize: 16,
  },
  disabledButton2: {
    backgroundColor: '#cccccc',
  },
  partNumberInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    marginLeft:25
  },
  partNumberInput: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    paddingHorizontal: 10,
    borderRadius: 5,
    flex: 0.54, // let the input take remaining space
    marginHorizontal: 5, // spacing between text input and add button
    marginLeft: 11,
  },
  deleteButton: {
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
