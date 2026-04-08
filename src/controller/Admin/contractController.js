import * as contractService from "../../services/Admin/contractService.js";

export const createContract = async (req, res) => {
  try {
    const file_url = req.file
      ? `/uploads/contracts/${req.file.filename}`
      : null;
    const contract = await contractService.createContract({
      ...req.body,
      created_by: req.user.id,
      file_url,
    });
    res.status(201).json({ success: true, data: contract });
  } catch (err) {
    res
      .status(err.status || 400)
      .json({ success: false, message: err.message });
  }
};

export const getContracts = async (req, res) => {
  try {
    const contracts = await contractService.getContracts(req.query);
    res.json({ success: true, ...contracts });
  } catch (err) {
    res
      .status(err.status || 400)
      .json({ success: false, message: err.message });
  }
};

export const getContractById = async (req, res) => {
  try {
    const contract = await contractService.getContractById(req.params.id);
    res.json({ success: true, data: contract });
  } catch (err) {
    res
      .status(err.status || 400)
      .json({ success: false, message: err.message });
  }
};

export const updateContract = async (req, res) => {
  try {
    const file_url = req.file
      ? `/uploads/contracts/${req.file.filename}`
      : null;
    const contract = await contractService.updateContract(req.params.id, {
      ...req.body,
      file_url,
    });
    res.json({ success: true, data: contract });
  } catch (err) {
    res
      .status(err.status || 400)
      .json({ success: false, message: err.message });
  }
};
export const downloadContractFile = async (req, res) => {
  try {
    const filePath = await contractService.getContractFilePath(req.params.id);
    res.download(filePath);
  } catch (err) {
    res
      .status(err.status || 400)
      .json({ success: false, message: err.message });
  }
};
